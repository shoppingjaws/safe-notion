import { Command } from "commander";
import { loadCredentials } from "../credentials.ts";

export function createActivateCommand(): Command {
  const activate = new Command("activate")
    .description("Output environment variables for shell integration")
    .argument("<target>", "Target environment (currently only 'claude' is supported)")
    .action((target: string) => {
      if (target !== "claude") {
        console.error(`Unknown target: ${target}`);
        console.error("Supported targets: claude");
        process.exit(1);
      }

      // 1. 環境変数 NOTION_TOKEN が既に設定されていればそれを使用
      const envToken = process.env.NOTION_TOKEN;
      if (envToken) {
        // 標準出力に export 文を出力
        console.log(`export NOTION_TOKEN="${envToken}"`);
        return;
      }

      // 2. credentials.json からトークンを取得
      const credentials = loadCredentials();
      if (!credentials?.access_token) {
        console.error("Not authenticated. Run 'safe-notion auth' first.");
        process.exit(1);
      }

      // 標準出力に export 文を出力
      // eval $(safe-notion activate claude) で実行されることを想定
      console.log(`export NOTION_TOKEN="${credentials.access_token}"`);
    });

  return activate;
}
