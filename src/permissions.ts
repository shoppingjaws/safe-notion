import { Client } from "@notionhq/client";
import type {
  Config,
  Rule,
  OperationType,
  PermissionCheckResult,
  WriteCondition,
} from "./types.ts";

// Cache for parent hierarchy lookups with TTL
interface CacheEntry {
  value: string | null;
  expiresAt: number;
}
const parentCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function normalizeId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

function idsMatch(id1: string, id2: string): boolean {
  return normalizeId(id1) === normalizeId(id2);
}

async function getParentId(
  client: Client,
  resourceId: string
): Promise<string | null> {
  const normalizedId = normalizeId(resourceId);
  const now = Date.now();

  const cached = parentCache.get(normalizedId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    // Try as page first
    const page = await client.pages.retrieve({ page_id: resourceId });
    if ("parent" in page) {
      let parentId: string | null = null;
      if (page.parent.type === "page_id") {
        parentId = page.parent.page_id;
      } else if (page.parent.type === "database_id") {
        parentId = page.parent.database_id;
      } else if (page.parent.type === "data_source_id" && "database_id" in page.parent) {
        // Notion SDK v5+ returns data_source_id type with database_id field
        parentId = (page.parent as { database_id: string }).database_id;
      }
      parentCache.set(normalizedId, { value: parentId, expiresAt: now + CACHE_TTL_MS });
      return parentId;
    }
  } catch {
    // Not a page, try as block
    try {
      const block = await client.blocks.retrieve({ block_id: resourceId });
      if ("parent" in block) {
        let parentId: string | null = null;
        if (block.parent.type === "page_id") {
          parentId = block.parent.page_id;
        } else if (block.parent.type === "database_id") {
          parentId = block.parent.database_id;
        } else if (block.parent.type === "block_id") {
          parentId = block.parent.block_id;
        }
        parentCache.set(normalizedId, { value: parentId, expiresAt: now + CACHE_TTL_MS });
        return parentId;
      }
    } catch {
      // Not a block either, try as database
      try {
        const db = await client.databases.retrieve({ database_id: resourceId });
        if ("parent" in db) {
          let parentId: string | null = null;
          if (db.parent.type === "page_id") {
            parentId = db.parent.page_id;
          }
          parentCache.set(normalizedId, { value: parentId, expiresAt: now + CACHE_TTL_MS });
          return parentId;
        }
      } catch {
        // Resource not found
      }
    }
  }

  parentCache.set(normalizedId, { value: null, expiresAt: now + CACHE_TTL_MS });
  return null;
}

async function isDescendantOf(
  client: Client,
  resourceId: string,
  ancestorId: string,
  maxDepth = 10
): Promise<boolean> {
  if (idsMatch(resourceId, ancestorId)) {
    return true;
  }

  let currentId: string | null = resourceId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const parentId = await getParentId(client, currentId);
    if (!parentId) {
      return false;
    }
    if (idsMatch(parentId, ancestorId)) {
      return true;
    }
    currentId = parentId;
    depth++;
  }

  return false;
}

async function checkWriteCondition(
  client: Client,
  pageId: string,
  condition: WriteCondition
): Promise<boolean> {
  try {
    const page = await client.pages.retrieve({ page_id: pageId });

    if (!("properties" in page)) {
      return false;
    }

    const property = page.properties[condition.property];
    if (!property) {
      return false;
    }

    switch (condition.type) {
      case "people": {
        if (property.type !== "people") return false;
        return property.people.some((p) => p.id === condition.equals);
      }
      case "select": {
        if (property.type !== "select") return false;
        return property.select?.name === condition.equals;
      }
      case "multi_select": {
        if (property.type !== "multi_select") return false;
        return property.multi_select.some((s) => s.name === condition.equals);
      }
      case "status": {
        if (property.type !== "status") return false;
        return property.status?.name === condition.equals;
      }
      case "checkbox": {
        if (property.type !== "checkbox") return false;
        return property.checkbox === condition.equals;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export async function checkPermission(
  client: Client,
  config: Config,
  resourceId: string,
  operation: OperationType,
  pageIdForCondition?: string
): Promise<PermissionCheckResult> {
  // Find matching rule
  for (const rule of config.rules) {
    let matches = false;

    if (rule.pageId) {
      matches = await isDescendantOf(client, resourceId, rule.pageId);
    } else if (rule.databaseId) {
      // For database rules, check if resource is the database itself or a page in it
      if (idsMatch(resourceId, rule.databaseId)) {
        matches = true;
      } else {
        // Check if resource is a child of the database
        const parentId = await getParentId(client, resourceId);
        if (parentId && idsMatch(parentId, rule.databaseId)) {
          matches = true;
        }
      }
    }

    if (matches) {
      // Check if operation is allowed
      const permissionMap: Record<OperationType, string> = {
        read: "read",
        write: "write",
        create: "create",
        delete: "delete",
      };

      const hasPermission = rule.permissions.includes(
        permissionMap[operation] as Rule["permissions"][number]
      );

      if (!hasPermission) {
        return {
          allowed: false,
          rule,
          reason: `Operation '${operation}' not allowed by rule '${rule.name}'`,
        };
      }

      // Check write condition for write operations
      if (
        (operation === "write" || operation === "create") &&
        rule.writeCondition
      ) {
        const targetPageId = pageIdForCondition ?? resourceId;
        const conditionMet = await checkWriteCondition(
          client,
          targetPageId,
          rule.writeCondition
        );

        if (!conditionMet) {
          return {
            allowed: false,
            rule,
            reason: `Write condition not met: ${rule.writeCondition.property} must equal '${rule.writeCondition.equals}'`,
          };
        }
      }

      return {
        allowed: true,
        rule,
        reason: `Allowed by rule '${rule.name}'`,
      };
    }
  }

  // No matching rule, use default permission
  if (config.defaultPermission === "read" && operation === "read") {
    return {
      allowed: true,
      reason: "Allowed by default read permission",
    };
  }

  return {
    allowed: false,
    reason: "No matching rule and default permission is deny",
  };
}

export function clearCache(): void {
  parentCache.clear();
}
