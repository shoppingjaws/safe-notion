# safe-notion

AIエージェント向けの安全なNotion APIラッパーCLI。きめ細かな権限制御により、AIエージェントとNotion API間のセキュリティレイヤーとして機能します。

## 特徴

- **きめ細かな権限制御**: `resource:operation` 形式（例: `page:read`, `database:query`）で操作を制限
- **階層認識**: 子ページは親ページのルールを継承
- **条件付きアクセス**: Notionプロパティの値に基づいたアクセス制御
- **デフォルト拒否**: 明示的に許可されない限り、すべての操作を拒否

## インストール

```bash
npm install -g safe-notion
```

## 設定

### 環境変数

```bash
export NOTION_TOKEN="your-notion-integration-token"
```

### 設定ファイル

設定ファイルを初期化:

```bash
safe-notion config init
```

設定ファイルの場所: `~/.config/safe-notion/config.jsonc`

### 設定例

```jsonc
{
  "rules": [
    {
      // 特定ページとその子孫に読み取り専用アクセス
      "name": "docs-readonly",
      "pageId": "12345678-1234-1234-1234-123456789abc",
      "permissions": ["page:read", "block:read"]
    },
    {
      // データベースへのクエリと新規作成のみ許可
      "name": "tasks-db",
      "databaseId": "87654321-4321-4321-4321-cba987654321",
      "permissions": ["database:read", "database:query", "database:create"]
    },
    {
      // 条件付きアクセス: 担当者が自分の場合のみ更新可能
      "name": "my-tasks-only",
      "databaseId": "87654321-4321-4321-4321-cba987654321",
      "permissions": ["page:update"],
      "condition": {
        "property": "担当者",
        "type": "people",
        "equals": "me"
      }
    }
  ],
  "defaultPermission": "deny"
}
```

## 使用可能な権限

| リソース | 権限 | 説明 |
|---------|------|------|
| Page | `page:read` | ページの読み取り |
| Page | `page:update` | ページの更新 |
| Page | `page:create` | ページの作成 |
| Database | `database:read` | データベースの読み取り |
| Database | `database:query` | データベースのクエリ |
| Database | `database:create` | データベースへのページ作成 |
| Block | `block:read` | ブロックの読み取り |
| Block | `block:append` | ブロックの追加 |
| Block | `block:delete` | ブロックの削除 |

## CLIコマンド

### ページ操作

```bash
safe-notion page get <page-id>
safe-notion page create --parent <parent-id> --title "タイトル"
safe-notion page update <page-id>
```

### データベース操作

```bash
safe-notion db get <database-id>
safe-notion db query <database-id>
safe-notion db create-page <database-id>
```

### ブロック操作

```bash
safe-notion block get <block-id>
safe-notion block children <block-id>
safe-notion block append <block-id> --children '<json>'
safe-notion block delete <block-id>
```

### 設定管理

```bash
safe-notion config init      # 設定ファイルを初期化
safe-notion config validate  # 設定を検証
safe-notion config path      # 設定ファイルのパスを表示
```

## 開発

### 依存関係のインストール

```bash
bun install
```

### ビルド

```bash
bun run build
```

### 型チェック

```bash
bun run typecheck
```

## ライセンス

MIT
