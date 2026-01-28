import { Command } from "commander";
import { getClient } from "../notion-client.ts";
import { outputJson, handleError } from "./utils.ts";

export function createSearchCommand(): Command {
  const search = new Command("search").description("Search pages and databases");

  search
    .argument("[query]", "Search query string")
    .option("--filter <type>", "Filter by object type: page or database")
    .option(
      "--sort <direction>",
      "Sort by last_edited_time: ascending or descending"
    )
    .option("--start-cursor <cursor>", "Pagination cursor")
    .option("--page-size <size>", "Number of results per page", "100")
    .action(async (query: string | undefined, options) => {
      try {
        const client = getClient();

        const params: {
          query?: string;
          filter?: { property: "object"; value: "page" | "data_source" };
          sort?: {
            direction: "ascending" | "descending";
            timestamp: "last_edited_time";
          };
          start_cursor?: string;
          page_size?: number;
        } = {};

        if (query) {
          params.query = query;
        }

        if (options.filter) {
          // SDK 5.x uses "data_source" instead of "database"
          const filterValue =
            options.filter === "database" ? "data_source" : options.filter;
          if (filterValue !== "page" && filterValue !== "data_source") {
            throw {
              error:
                "Invalid filter value. Must be 'page' or 'database'",
              code: "INVALID_ARGUMENT",
            };
          }
          params.filter = { property: "object", value: filterValue };
        }

        if (options.sort) {
          if (
            options.sort !== "ascending" &&
            options.sort !== "descending"
          ) {
            throw {
              error:
                "Invalid sort value. Must be 'ascending' or 'descending'",
              code: "INVALID_ARGUMENT",
            };
          }
          params.sort = {
            direction: options.sort,
            timestamp: "last_edited_time",
          };
        }

        if (options.startCursor) {
          params.start_cursor = options.startCursor;
        }

        if (options.pageSize) {
          params.page_size = parseInt(options.pageSize, 10);
        }

        const result = await client.search(params);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  return search;
}
