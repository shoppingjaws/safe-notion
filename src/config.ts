import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { ConfigSchema, type Config } from "./types.ts";

const CONFIG_DIR = join(homedir(), ".config", "safe-notion");
const CONFIG_PATH = join(CONFIG_DIR, "config.jsonc");

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found: ${CONFIG_PATH}\nRun 'notion-safe config init' to create a template.`
    );
  }

  const content = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = parseJsonc(content);

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid config file:\n${errors}`);
  }

  return result.data;
}

export function validateConfig(configPath?: string): {
  valid: boolean;
  errors?: string[];
} {
  const path = configPath ?? CONFIG_PATH;

  if (!existsSync(path)) {
    return { valid: false, errors: [`Config file not found: ${path}`] };
  }

  try {
    const content = readFileSync(path, "utf-8");
    const parsed = parseJsonc(content);
    const result = ConfigSchema.safeParse(parsed);

    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map(
          (e) => `${e.path.join(".")}: ${e.message}`
        ),
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

export function initConfig(): string {
  if (existsSync(CONFIG_PATH)) {
    throw new Error(`Config file already exists: ${CONFIG_PATH}`);
  }

  const template = `{
  // Safe Notion - Configuration
  // Rules are evaluated in order; first matching rule applies
  //
  // Permission types (granular format):
  //   page:read, page:update, page:create
  //   database:read, database:query, database:create
  //   block:read, block:append, block:delete
  "rules": [
    {
      // Rule name (for logging)
      "name": "Example - Read only page",
      // Page ID (applies to this page and all children)
      "pageId": "00000000-0000-0000-0000-000000000000",
      "permissions": ["page:read", "database:read", "database:query", "block:read"]
    },
    {
      "name": "Example - Read + block append only",
      // Allows reading and adding blocks, but NOT updating page properties or deleting
      "pageId": "11111111-1111-1111-1111-111111111111",
      "permissions": ["page:read", "database:read", "database:query", "block:read", "block:append"]
    },
    {
      "name": "Example - Database with conditional write",
      // Database ID
      "databaseId": "22222222-2222-2222-2222-222222222222",
      "permissions": ["page:read", "database:read", "database:query", "block:read", "page:update", "block:append"],
      // Optional: Only allow if this condition is met
      "condition": {
        "property": "Assignee",  // Property name
        "type": "people",        // Property type: people, select, multi_select, status, checkbox
        "equals": "user-id"      // Value to match (user ID for people, string for others)
      }
    },
    {
      "name": "Example - Database query and create only",
      // Allows querying and creating pages in DB, but NOT updating existing pages
      "databaseId": "33333333-3333-3333-3333-333333333333",
      "permissions": ["database:read", "database:query", "database:create"]
    },
    {
      "name": "Example - Full access page",
      "pageId": "44444444-4444-4444-4444-444444444444",
      "permissions": ["page:read", "page:update", "page:create", "database:read", "database:query", "database:create", "block:read", "block:append", "block:delete"]
    }
  ],
  // Default behavior when no rule matches: "deny" or "read"
  "defaultPermission": "deny"
}
`;

  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, template, "utf-8");

  return CONFIG_PATH;
}

export function getNotionToken(): string {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error(
      "NOTION_TOKEN environment variable is not set.\n" +
        "Get your API token from https://www.notion.so/my-integrations"
    );
  }
  return token;
}
