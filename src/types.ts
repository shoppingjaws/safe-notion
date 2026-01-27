import { z } from "zod";

// Granular permission types (resource:operation format)
export const GranularPermissionValues = [
  "page:read",
  "page:update",
  "page:create",
  "database:read",
  "database:query",
  "database:create",
  "block:read",
  "block:append",
  "block:delete",
] as const;

export type GranularPermission = (typeof GranularPermissionValues)[number];

// Permission schema (granular format only)
export const PermissionSchema = z.enum(GranularPermissionValues);
export type Permission = z.infer<typeof PermissionSchema>;

// Condition for conditional access
export const ConditionSchema = z.object({
  property: z.string(),
  type: z.enum(["people", "select", "multi_select", "status", "checkbox"]),
  equals: z.union([z.string(), z.boolean()]),
});
export type Condition = z.infer<typeof ConditionSchema>;

// Single rule definition
export const RuleSchema = z
  .object({
    name: z.string(),
    pageId: z.string().uuid().optional(),
    databaseId: z.string().uuid().optional(),
    permissions: z.array(PermissionSchema),
    condition: ConditionSchema.optional(),
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

// Operation types for permission checking (uses granular permission format)
export type OperationType = GranularPermission;

// Resource types
export type ResourceType = "page" | "database" | "block";

// Resource identifier
export interface ResourceIdentifier {
  type: ResourceType;
  id: string;
  parentId?: string;
}
