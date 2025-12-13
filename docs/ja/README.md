<div align="center">

# CCS - Claude Code Switch

![CCS Logo](../assets/ccs-logo-medium.png)

### 1つのダッシュボードで複数のAIアカウントを管理。
Claude、Gemini、GLM、その他を同時に実行 - 競合なしで。

[![License](https://img.shields.io/badge/license-MIT-C15F3C?style=for-the-badge)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@kaitranntt/ccs?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@kaitranntt/ccs)
[![PoweredBy](https://img.shields.io/badge/PoweredBy-ClaudeKit-C15F3C?style=for-the-badge)](https://claudekit.cc?ref=HMNKXOHN)

**[機能 & 料金](https://ccs.kaitran.ca)** | **[ドキュメント](../en/)** | [English](../../README.md) | [Tiếng Việt](../vi/README.md)

</div>

<br>

## 3つの柱

| 機能 | 説明 | 管理方法 |
|------|------|----------|
| **複数Claudeアカウント** | 仕事用 + 個人用のClaudeを同時実行 | ダッシュボード |
| **OAuthプロバイダー** | Gemini、Codex、Antigravity - APIキー不要 | ダッシュボード |
| **APIプロファイル** | 自分のAPIキーでGLM、Kimiを利用 | ダッシュボード |

<br>

## クイックスタート

### 1. インストール

```bash
npm install -g @kaitranntt/ccs
```

<details>
<summary>他のパッケージマネージャー</summary>

```bash
yarn global add @kaitranntt/ccs    # yarn
pnpm add -g @kaitranntt/ccs        # pnpm (70%ディスク節約)
bun add -g @kaitranntt/ccs         # bun (30倍高速)
```

</details>

### 2. ダッシュボードを開く

```bash
ccs config
# http://localhost:3000 を開きます
```

### 3. アカウントを設定

ダッシュボードはすべてのアカウントタイプをビジュアルに管理できます：

- **Claudeアカウント**: 分離されたインスタンスを作成（仕事、個人、クライアント）
- **OAuthプロバイダー**: Gemini、Codex、Antigravityのワンクリック認証
- **APIプロファイル**: 自分のキーでGLM、Kimiを設定
- **ヘルスモニター**: すべてのプロファイルのリアルタイムステータス

**アナリティクス (ライト/ダークテーマ)**

![Analytics Light](../assets/screenshots/analytics-light.png)

![Analytics Dark](../assets/screenshots/analytics.png)

**APIプロファイル & OAuthプロバイダー**

![API Profiles](../assets/screenshots/api_profiles.png)

![CLIProxy](../assets/screenshots/cliproxy.png)

<br>

## サポートされているプロバイダー

| プロバイダー | 認証タイプ | コマンド | 最適な用途 |
|--------------|------------|----------|------------|
| **Claude** | サブスクリプション | `ccs` | デフォルト、戦略的計画 |
| **Gemini** | OAuth | `ccs gemini` | ゼロ設定、高速イテレーション |
| **Codex** | OAuth | `ccs codex` | コード生成 |
| **Antigravity** | OAuth | `ccs agy` | 代替ルーティング |
| **GLM** | APIキー | `ccs glm` | コスト最適化 |
| **Kimi** | APIキー | `ccs kimi` | ロングコンテキスト、思考モード |

> **OAuthプロバイダー**は初回実行時にブラウザで認証します。トークンは `~/.ccs/cliproxy/auth/` にキャッシュされます。

<br>

## 使用方法

### 基本コマンド

```bash
ccs           # デフォルトのClaudeセッション
ccs agy       # Antigravity (OAuth)
ccs gemini    # Gemini (OAuth)
ccs glm       # GLM (APIキー)
```

### 並列ワークフロー

異なるプロバイダーで複数のターミナルを実行：

```bash
# ターミナル1: 計画 (Claude Pro)
ccs work "認証システムを設計"

# ターミナル2: 実行 (GLM - コスト最適化)
ccs glm "計画に基づいてユーザーサービスを実装"

# ターミナル3: レビュー (Gemini)
ccs gemini "セキュリティ問題について実装をレビュー"
```

### マルチアカウントClaude

仕事/個人用に分離されたClaudeインスタンスを作成：

```bash
ccs auth create work

# 別々のターミナルで同時実行
ccs work "機能を実装"    # ターミナル1
ccs "コードをレビュー"   # ターミナル2 (個人アカウント)
```

<br>

## メンテナンス

### ヘルスチェック

```bash
ccs doctor
```

検証: Claude CLI、設定ファイル、シンボリックリンク、パーミッション。

### アップデート

```bash
ccs update              # 最新版にアップデート
ccs update --force      # 強制再インストール
ccs update --beta       # devチャンネルをインストール
```

### 共有アイテムの同期

```bash
ccs sync
```

共有コマンド、スキル、設定のシンボリックリンクを再作成します。

<br>

## 設定

CCSはインストール時に自動的に設定を作成します。ダッシュボードが設定管理の推奨方法です。

**設定の場所**: `~/.ccs/config.yaml`

<details>
<summary>カスタムClaude CLIパス</summary>

Claude CLIが標準以外の場所にインストールされている場合：

```bash
export CCS_CLAUDE_PATH="/path/to/claude"              # Unix
$env:CCS_CLAUDE_PATH = "D:\Tools\Claude\claude.exe"   # Windows
```

</details>

<details>
<summary>Windowsシンボリックリンクサポート</summary>

真のシンボリックリンクには開発者モードを有効にしてください：

1. **設定** → **プライバシーとセキュリティ** → **開発者向け**
2. **開発者モード**を有効化
3. 再インストール: `npm install -g @kaitranntt/ccs`

開発者モードがない場合、CCSはディレクトリコピーにフォールバックします。

</details>

<br>

## ドキュメント

| トピック | リンク |
|----------|--------|
| インストール | [docs/en/installation.md](../en/installation.md) |
| 設定 | [docs/en/configuration.md](../en/configuration.md) |
| OAuthプロバイダー | [docs/en/oauth.md](../en/oauth.md) |
| マルチアカウントClaude | [docs/en/multi-account.md](../en/multi-account.md) |
| デリゲーション | [docs/en/delegation.md](../en/delegation.md) |
| GLMT (実験的) | [docs/en/glmt.md](../en/glmt.md) |
| アーキテクチャ | [docs/system-architecture.md](../system-architecture.md) |
| トラブルシューティング | [docs/en/troubleshooting.md](../en/troubleshooting.md) |

<br>

## アンインストール

```bash
npm uninstall -g @kaitranntt/ccs
```

<details>
<summary>他のパッケージマネージャー</summary>

```bash
yarn global remove @kaitranntt/ccs
pnpm remove -g @kaitranntt/ccs
bun remove -g @kaitranntt/ccs
```

</details>

<br>

## 哲学

- **YAGNI**: 「念のため」の機能なし
- **KISS**: シンプルで焦点を絞った実装
- **DRY**: 単一の信頼できる情報源（設定）

<br>

## コントリビューション

[CONTRIBUTING.md](../../CONTRIBUTING.md)をご覧ください。

<br>

## ライセンス

MITライセンス - [LICENSE](../../LICENSE)をご覧ください。

<div align="center">

---

**[ccs.kaitran.ca](https://ccs.kaitran.ca)** | [問題を報告](https://github.com/kaitranntt/ccs/issues) | [GitHubでスター](https://github.com/kaitranntt/ccs)

</div>
