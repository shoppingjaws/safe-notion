#!/usr/bin/env bun

import { Command } from "commander";
import { createPageCommand } from "./commands/page.ts";
import { createDbCommand } from "./commands/db.ts";
import { createBlockCommand } from "./commands/block.ts";
import { createConfigCommand } from "./commands/config.ts";

const program = new Command();

program
  .name("notion-safe")
  .description("A safe Notion API wrapper CLI for AI agents")
  .version("0.1.0");

program.addCommand(createPageCommand());
program.addCommand(createDbCommand());
program.addCommand(createBlockCommand());
program.addCommand(createConfigCommand());

program.parse();
