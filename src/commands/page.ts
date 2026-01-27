import { Command } from "commander";
import { getClient } from "../notion-client.ts";
import { outputJson, handleError } from "./utils.ts";

export function createPageCommand(): Command {
  const page = new Command("page").description("Page operations");

  page
    .command("get")
    .description("Get a page by ID")
    .argument("<page-id>", "Page ID")
    .action(async (pageId: string) => {
      try {
        const client = getClient();
        const result = await client.getPage(pageId);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  page
    .command("create")
    .description("Create a new page")
    .requiredOption("--parent <id>", "Parent page ID")
    .requiredOption("--title <title>", "Page title")
    .option("--icon <emoji>", "Page icon emoji")
    .option("--content <json>", "Page content as JSON array of blocks")
    .action(async (options) => {
      try {
        const client = getClient();

        const properties: Record<string, unknown> = {
          title: {
            title: [{ text: { content: options.title } }],
          },
        };

        const params: {
          parent: { page_id: string };
          properties: typeof properties;
          icon?: { emoji: string };
          children?: unknown[];
        } = {
          parent: { page_id: options.parent },
          properties,
        };

        if (options.icon) {
          params.icon = { emoji: options.icon };
        }

        if (options.content) {
          params.children = JSON.parse(options.content);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await client.createPage(params as any);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  page
    .command("update")
    .description("Update a page")
    .argument("<page-id>", "Page ID")
    .requiredOption("--properties <json>", "Properties to update as JSON")
    .action(async (pageId: string, options) => {
      try {
        const client = getClient();
        const properties = JSON.parse(options.properties);
        const result = await client.updatePage(pageId, properties);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  return page;
}
