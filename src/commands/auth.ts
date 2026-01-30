import { Command } from "commander";
import { runOAuthFlow } from "../auth.ts";
import { loadCredentials, deleteCredentials, getCredentialsPath } from "../credentials.ts";
import { outputJson, handleError } from "./utils.ts";

export function createAuthCommand(): Command {
  const auth = new Command("auth").description("OAuth authentication with Notion");

  auth
    .command("login")
    .description("Authenticate with Notion via OAuth")
    .action(async () => {
      try {
        const credentials = await runOAuthFlow();
        outputJson({
          success: true,
          workspace_name: credentials.workspace_name,
          workspace_id: credentials.workspace_id,
          message: "Successfully authenticated with Notion!",
        });
      } catch (error) {
        handleError(error);
      }
    });

  auth
    .command("logout")
    .description("Remove stored OAuth credentials")
    .action(() => {
      try {
        const deleted = deleteCredentials();
        if (deleted) {
          outputJson({
            success: true,
            message: "Credentials removed successfully.",
          });
        } else {
          outputJson({
            success: false,
            message: "No credentials found to remove.",
          });
        }
      } catch (error) {
        handleError(error);
      }
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .action(() => {
      try {
        const credentials = loadCredentials();

        if (!credentials) {
          outputJson({
            authenticated: false,
            credentials_path: getCredentialsPath(),
            message: "Not authenticated. Run 'safe-notion auth login' to authenticate.",
          });
          return;
        }

        outputJson({
          authenticated: true,
          credentials_path: getCredentialsPath(),
          workspace_name: credentials.workspace_name,
          workspace_id: credentials.workspace_id,
          bot_id: credentials.bot_id,
          owner: credentials.owner,
        });
      } catch (error) {
        handleError(error);
      }
    });

  // デフォルトでloginを実行（safe-notion auth で直接認証開始）
  auth.action(async () => {
    try {
      const credentials = await runOAuthFlow();
      outputJson({
        success: true,
        workspace_name: credentials.workspace_name,
        workspace_id: credentials.workspace_id,
        message: "Successfully authenticated with Notion!",
      });
    } catch (error) {
      handleError(error);
    }
  });

  return auth;
}
