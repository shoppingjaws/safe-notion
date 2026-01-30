import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "safe-notion");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

export interface Credentials {
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

export function getCredentialsPath(): string {
  return CREDENTIALS_PATH;
}

export function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_PATH)) {
    return null;
  }

  try {
    const content = readFileSync(CREDENTIALS_PATH, "utf-8");
    const parsed = JSON.parse(content);
    return parsed as Credentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: Credentials): void {
  mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), "utf-8");
  // ファイル権限を600（所有者のみ読み書き可能）に設定
  chmodSync(CREDENTIALS_PATH, 0o600);
}

export function deleteCredentials(): boolean {
  if (!existsSync(CREDENTIALS_PATH)) {
    return false;
  }

  try {
    unlinkSync(CREDENTIALS_PATH);
    return true;
  } catch {
    return false;
  }
}
