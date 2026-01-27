import { Command } from "commander";
import { getClient } from "../notion-client.ts";
import { outputJson, handleError } from "./utils.ts";

export function createDbCommand(): Command {
  const db = new Command("db").description("Database operations");

  db.command("get")
    .description("Get a database by ID")
    .argument("<database-id>", "Database ID")
    .action(async (databaseId: string) => {
      try {
        const client = getClient();
        const result = await client.getDatabase(databaseId);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  db.command("query")
    .description("Query a database")
    .argument("<database-id>", "Database ID")
    .option("--filter <json>", "Filter as JSON")
    .option("--sorts <json>", "Sorts as JSON array")
    .option("--start-cursor <cursor>", "Pagination cursor")
    .option("--page-size <size>", "Number of results per page", "100")
    .action(async (databaseId: string, options) => {
      try {
        const client = getClient();

        const params: {
          filter?: unknown;
          sorts?: unknown[];
          start_cursor?: string;
          page_size?: number;
        } = {};

        if (options.filter) {
          params.filter = JSON.parse(options.filter);
        }

        if (options.sorts) {
          params.sorts = JSON.parse(options.sorts);
        }

        if (options.startCursor) {
          params.start_cursor = options.startCursor;
        }

        if (options.pageSize) {
          params.page_size = parseInt(options.pageSize, 10);
        }

        const result = await client.queryDatabase(databaseId, params);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  db.command("create-page")
    .description("Create a new page in a database")
    .argument("<database-id>", "Database ID")
    .requiredOption("--properties <json>", "Page properties as JSON")
    .action(async (databaseId: string, options) => {
      try {
        const client = getClient();
        const properties = JSON.parse(options.properties);
        const result = await client.createDatabasePage(databaseId, properties);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  return db;
}
