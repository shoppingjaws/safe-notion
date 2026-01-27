import { Command } from "commander";
import { getClient } from "../notion-client.ts";
import { outputJson, handleError } from "./utils.ts";

export function createBlockCommand(): Command {
  const block = new Command("block").description("Block operations");

  block
    .command("get")
    .description("Get a block by ID")
    .argument("<block-id>", "Block ID")
    .action(async (blockId: string) => {
      try {
        const client = getClient();
        const result = await client.getBlock(blockId);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  block
    .command("children")
    .description("Get children of a block")
    .argument("<block-id>", "Block ID (can also be a page ID)")
    .option("--start-cursor <cursor>", "Pagination cursor")
    .option("--page-size <size>", "Number of results per page")
    .action(async (blockId: string, options) => {
      try {
        const client = getClient();
        const result = await client.getBlockChildren(
          blockId,
          options.startCursor,
          options.pageSize ? parseInt(options.pageSize, 10) : undefined
        );
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  block
    .command("append")
    .description("Append children to a block")
    .argument("<block-id>", "Block ID (can also be a page ID)")
    .requiredOption("--children <json>", "Children blocks as JSON array")
    .action(async (blockId: string, options) => {
      try {
        const client = getClient();
        const children = JSON.parse(options.children);
        const result = await client.appendBlockChildren(blockId, children);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  block
    .command("delete")
    .description("Delete a block")
    .argument("<block-id>", "Block ID")
    .action(async (blockId: string) => {
      try {
        const client = getClient();
        const result = await client.deleteBlock(blockId);
        outputJson(result);
      } catch (error) {
        handleError(error);
      }
    });

  return block;
}
