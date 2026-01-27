import { z } from "zod";

// Permission types
export const PermissionSchema = z.enum(["read", "write", "create", "delete"]);
export type Permission = z.infer<typeof PermissionSchema>;

// Write condition for conditional access
export const WriteConditionSchema = z.object({
  property: z.string(),
  type: z.enum(["people", "select", "multi_select", "status", "checkbox"]),
  equals: z.union([z.string(), z.boolean()]),
});
export type WriteCondition = z.infer<typeof WriteConditionSchema>;

// Single rule definition
export const RuleSchema = z
  .object({
    name: z.string(),
    pageId: z.string().uuid().optional(),
    databaseId: z.string().uuid().optional(),
    permissions: z.array(PermissionSchema),
    writeCondition: WriteConditionSchema.optional(),
  })
  .refine((data) => data.pageId || data.databaseId, {
    message: "Either pageId or databaseId must be specified",
  });
export type Rule = z.infer<typeof RuleSchema>;

// Configuration file schema
export const ConfigSchema = z.object({
  rules: z.array(RuleSchema),
  defaultPermission: z.enum(["deny", "read"]).default("deny"),
});
export type Config = z.infer<typeof ConfigSchema>;

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean;
  rule?: Rule;
  reason: string;
}

// Error response format
export interface ErrorResponse {
  error: string;
  code: string;
}

// Operation types for permission checking
export type OperationType = "read" | "write" | "create" | "delete";

// Resource types
export type ResourceType = "page" | "database" | "block";

// Resource identifier
export interface ResourceIdentifier {
  type: ResourceType;
  id: string;
  parentId?: string;
}
