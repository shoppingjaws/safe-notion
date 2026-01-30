import { saveCredentials, type Credentials } from "./credentials.ts";
import { getOAuthConfig, type OAuthConfig } from "./config.ts";

interface NotionOAuthErrorResponse {
  error?: string;
}

interface NotionOAuthTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_icon?: string;
  owner?: {
    type: string;
    user?: {
      id: string;
      name?: string;
    };
  };
  duplicated_template_id?: string;
  request_id?: string;
}

// Notion OAuth endpoints
const NOTION_OAUTH_AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_OAUTH_TOKEN_URL = "https://api.notion.com/v1/oauth/token";

// Local callback server settings
const CALLBACK_PORT = 9876;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

/**
 * CSRF対策用のランダムなstate文字列を生成
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Notion OAuth認可URLを構築
 */
export function buildAuthorizationUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    state: state,
    owner: "user",
  });

  return `${NOTION_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 認可コードをアクセストークンに交換
 */
export async function exchangeCodeForToken(
  config: OAuthConfig,
  code: string
): Promise<Credentials> {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const response = await fetch(NOTION_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const errorResponse = (await response.json()) as NotionOAuthErrorResponse;
    throw new Error(`Token exchange failed: ${errorResponse.error || response.statusText}`);
  }

  const tokenResponse = (await response.json()) as NotionOAuthTokenResponse;

  return {
    access_token: tokenResponse.access_token,
    token_type: tokenResponse.token_type,
    bot_id: tokenResponse.bot_id,
    workspace_id: tokenResponse.workspace_id,
    workspace_name: tokenResponse.workspace_name,
    workspace_icon: tokenResponse.workspace_icon,
    owner: tokenResponse.owner,
    duplicated_template_id: tokenResponse.duplicated_template_id,
    request_id: tokenResponse.request_id,
  };
}

/**
 * ローカルコールバックサーバーを起動して認可コードを受け取る
 */
export function startCallbackServer(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = Bun.serve({
      port: CALLBACK_PORT,
      hostname: "127.0.0.1", // localhost only for security
      fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/callback") {
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          // Close server after handling the request
          setTimeout(() => server.stop(), 100);

          if (error) {
            reject(new Error(`Authorization error: ${error}`));
            return new Response(
              createHtmlResponse(
                "認証エラー",
                `認証に失敗しました: ${error}`,
                false
              ),
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
          }

          if (!code) {
            reject(new Error("No authorization code received"));
            return new Response(
              createHtmlResponse(
                "エラー",
                "認可コードが見つかりませんでした。",
                false
              ),
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
          }

          if (state !== expectedState) {
            reject(new Error("State mismatch - possible CSRF attack"));
            return new Response(
              createHtmlResponse(
                "セキュリティエラー",
                "state パラメータが一致しません。再度お試しください。",
                false
              ),
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
          }

          resolve(code);
          return new Response(
            createHtmlResponse(
              "認証成功",
              "Notion との連携が完了しました。このウィンドウを閉じてください。",
              true
            ),
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.stop();
      reject(new Error("Authentication timeout - no callback received within 5 minutes"));
    }, 5 * 60 * 1000);
  });
}

/**
 * HTMLレスポンスを生成
 */
function createHtmlResponse(title: string, message: string, success: boolean): string {
  const color = success ? "#22c55e" : "#ef4444";
  const icon = success ? "✓" : "✗";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - safe-notion</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      color: ${color};
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin: 0 0 16px;
    }
    p {
      color: #666;
      margin: 0;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

/**
 * ブラウザでURLを開く
 */
export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;

  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", url];
  } else {
    // Linux
    command = "xdg-open";
    args = [url];
  }

  const proc = Bun.spawn([command, ...args], {
    stdout: "ignore",
    stderr: "ignore",
  });

  await proc.exited;
}

/**
 * OAuth認証フローを実行
 */
export async function runOAuthFlow(): Promise<Credentials> {
  const config = getOAuthConfig();
  const state = generateState();

  // ローカルサーバーを起動（コールバック待機）
  const codePromise = startCallbackServer(state);

  // 認可URLを構築してブラウザを開く
  const authUrl = buildAuthorizationUrl(config, state);

  console.error("ブラウザで Notion の認可画面を開きます...");
  console.error(`URL: ${authUrl}`);

  await openBrowser(authUrl);

  console.error("認可を待っています...");

  // 認可コードを受け取る
  const code = await codePromise;

  console.error("認可コードを受け取りました。トークンを取得中...");

  // トークンに交換
  const credentials = await exchangeCodeForToken(config, code);

  // 保存
  saveCredentials(credentials);

  return credentials;
}
