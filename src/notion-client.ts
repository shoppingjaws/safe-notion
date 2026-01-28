import { Client } from "@notionhq/client";
import { LogLevel } from "@notionhq/client/build/src/logging";
import { loadConfig, getNotionToken } from "./config.ts";
import { checkPermission, clearCache } from "./permissions.ts";
import type { Config, ErrorResponse, OperationType } from "./types.ts";

// Debug mode flag
let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
  // Reset client instance to apply new log level
  clientInstance = null;
}

// Use generic types to avoid issues with Notion SDK version changes
type CreatePageParams = Parameters<Client["pages"]["create"]>[0];
type UpdatePageParams = Parameters<Client["pages"]["update"]>[0];
type AppendBlockChildrenParams = Parameters<
  Client["blocks"]["children"]["append"]
>[0];

interface QueryParams {
  filter?: unknown;
  sorts?: unknown[];
  start_cursor?: string;
  page_size?: number;
}

export class NotionSafeClient {
  private client: Client;
  private config: Config;

  constructor() {
    const token = getNotionToken();
    this.client = new Client({
      auth: token,
      logLevel: debugMode ? LogLevel.WARN : LogLevel.ERROR,
    });
    this.config = loadConfig();
  }

  private async ensurePermission(
    resourceId: string,
    operation: OperationType,
    pageIdForCondition?: string
  ): Promise<void> {
    const result = await checkPermission(
      this.client,
      this.config,
      resourceId,
      operation,
      pageIdForCondition
    );

    if (!result.allowed) {
      const error: ErrorResponse = {
        error: result.reason,
        code: "PERMISSION_DENIED",
      };
      throw error;
    }
  }

  // Page operations
  async getPage(pageId: string): Promise<unknown> {
    await this.ensurePermission(pageId, "page:read");
    return this.client.pages.retrieve({ page_id: pageId });
  }

  async createPage(params: CreatePageParams): Promise<unknown> {
    // Determine parent ID for permission check
    let parentId: string;
    if (params.parent && "page_id" in params.parent) {
      parentId = params.parent.page_id;
    } else if (params.parent && "database_id" in params.parent) {
      parentId = params.parent.database_id;
    } else {
      throw { error: "Invalid parent type", code: "INVALID_PARENT" };
    }

    await this.ensurePermission(parentId, "page:create");
    return this.client.pages.create(params);
  }

  async updatePage(
    pageId: string,
    properties: UpdatePageParams["properties"]
  ): Promise<unknown> {
    await this.ensurePermission(pageId, "page:update", pageId);
    return this.client.pages.update({ page_id: pageId, properties });
  }

  // Database operations
  async getDatabase(databaseId: string): Promise<unknown> {
    await this.ensurePermission(databaseId, "database:read");
    return this.client.databases.retrieve({ database_id: databaseId });
  }

  async queryDatabase(
    databaseId: string,
    params?: QueryParams
  ): Promise<unknown> {
    await this.ensurePermission(databaseId, "database:query");

    // Notion SDK 5.x では databases.query が dataSources.query に変更された
    // まずデータベースから data_source_id を取得
    const database = (await this.client.databases.retrieve({
      database_id: databaseId,
    })) as { data_sources?: Array<{ id: string }> };

    const dataSourceId = database.data_sources?.[0]?.id;
    if (!dataSourceId) {
      throw {
        error: "Database has no data source",
        code: "NO_DATA_SOURCE",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.client.dataSources.query({
      data_source_id: dataSourceId,
      ...params,
    } as any);
  }

  async createDatabasePage(
    databaseId: string,
    properties: CreatePageParams["properties"]
  ): Promise<unknown> {
    await this.ensurePermission(databaseId, "database:create");
    return this.client.pages.create({
      parent: { database_id: databaseId },
      properties,
    });
  }

  // Block operations
  async getBlock(blockId: string): Promise<unknown> {
    await this.ensurePermission(blockId, "block:read");
    return this.client.blocks.retrieve({ block_id: blockId });
  }

  async getBlockChildren(
    blockId: string,
    startCursor?: string,
    pageSize?: number
  ): Promise<unknown> {
    await this.ensurePermission(blockId, "block:read");
    return this.client.blocks.children.list({
      block_id: blockId,
      start_cursor: startCursor,
      page_size: pageSize,
    });
  }

  async appendBlockChildren(
    blockId: string,
    children: AppendBlockChildrenParams["children"]
  ): Promise<unknown> {
    await this.ensurePermission(blockId, "block:append");
    return this.client.blocks.children.append({
      block_id: blockId,
      children,
    });
  }

  async deleteBlock(blockId: string): Promise<unknown> {
    await this.ensurePermission(blockId, "block:delete");
    return this.client.blocks.delete({ block_id: blockId });
  }

  // Search operations
  async search(params: {
    query?: string;
    filter?: { property: "object"; value: "page" | "data_source" };
    sort?: {
      direction: "ascending" | "descending";
      timestamp: "last_edited_time";
    };
    start_cursor?: string;
    page_size?: number;
  }): Promise<unknown> {
    // Search permission check: allowed if defaultPermission is "read" or any rule has read permissions
    const hasReadPermission =
      this.config.defaultPermission === "read" ||
      this.config.rules.some((rule) =>
        rule.permissions.some((p) =>
          ["page:read", "database:read", "block:read"].includes(p)
        )
      );

    if (!hasReadPermission) {
      const error: ErrorResponse = {
        error: "Search not allowed: no read permissions configured",
        code: "PERMISSION_DENIED",
      };
      throw error;
    }

    return this.client.search(params);
  }

  // Clear the parent hierarchy cache
  clearCache(): void {
    clearCache();
  }
}

// Singleton instance
let clientInstance: NotionSafeClient | null = null;

export function getClient(): NotionSafeClient {
  if (!clientInstance) {
    clientInstance = new NotionSafeClient();
  }
  return clientInstance;
}
