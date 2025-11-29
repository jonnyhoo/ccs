<div align="center">

# CCS - Claude Code Switch

![CCS Logo](../../docs/assets/ccs-logo-medium.png)

### 1コマンド、ダウンタイムなし、複数アカウント

**複数のClaudeアカウント、GLM、Kimiを瞬時に切り替え。**
レート制限を回避し、継続的に作業。

<br>

[![License](https://img.shields.io/badge/license-MIT-C15F3C?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey?style=for-the-badge)]()
[![npm](https://img.shields.io/npm/v/@kaitranntt/ccs?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@kaitranntt/ccs)
[![PoweredBy](https://img.shields.io/badge/PoweredBy-ClaudeKit-C15F3C?style=for-the-badge)](https://claudekit.cc?ref=HMNKXOHN)

**Languages**: [English](../../README.md) · [Tiếng Việt](../vi/README.md) · [日本語](README.md)

</div>

<br>

## クイックスタート

### インストール

**npmパッケージ（推奨）**

**macOS / Linux / Windows**
```bash
npm install -g @kaitranntt/ccs
```

**主要なパッケージマネージャーすべてに対応：**

```bash
# yarn
yarn global add @kaitranntt/ccs

# pnpm（ディスク使用量70%削減）
pnpm add -g @kaitranntt/ccs

# bun（30倍高速）
bun add -g @kaitranntt/ccs
```

<details>
<summary><strong>[!] 非推奨: ネイティブシェルインストーラー（レガシー）</strong></summary>

<br>

> [!WARNING]
> **これらのインストーラーは非推奨であり、将来のバージョンで削除されます。**
> 現在は npm インストールに自動リダイレクトされます。npm を直接使用してください。

**macOS / Linux**
```bash
curl -fsSL ccs.kaitran.ca/install | bash
```

**Windows PowerShell**
```powershell
irm ccs.kaitran.ca/install | iex
```

**注**: スクリプトは非推奨の警告を表示し、Node.jsが利用可能な場合は自動的にnpmインストールを実行します。

</details>

<br>

### 設定（自動作成）

**CCSはインストール時に自動的に設定を作成します**（npm postinstallスクリプト経由）。

**~/.ccs/config.json**:
```json
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "glmt": "~/.ccs/glmt.settings.json",
    "kimi": "~/.ccs/kimi.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

<details>
<summary><h3>カスタムClaude CLIパス</h3></summary>

<br>

Claude CLIが標準以外の場所（Dドライブ、カスタムディレクトリ）にインストールされている場合は、`CCS_CLAUDE_PATH`を設定してください：

```bash
# Unix/Linux/macOS
export CCS_CLAUDE_PATH="/path/to/claude"

# Windows PowerShell
$env:CCS_CLAUDE_PATH = "D:\Tools\Claude\claude.exe"
```

**参照**: [トラブルシューティングガイド](./docs/en/troubleshooting.md#claude-cli-in-non-standard-location) 詳細な設定手順

</details>

<details>
<summary><h3>Windowsシンボリックリンクサポート（開発者モード）</h3></summary>

<br>

**Windowsユーザー**: 本物のシンボリックリンクで高速な動作と即時同期を得るために開発者モードを有効にしてください：

1. **設定** → **プライバシーとセキュリティ** → **開発者向け** を開く
2. **開発者モード** を有効にする
3. CCSを再インストール: `npm install -g @kaitranntt/ccs`

**警告**: 開発者モードなしの場合、CCSは自動的にディレクトリコピーにフォールバック（動作しますが、プロファイル間の即時同期はありません）

</details>

<br>

### 最初の切り替え

> [!IMPORTANT]
> **代替モデルを使用する前に、設定ファイルでAPIキーを更新してください：**
>
> - **GLM**: `~/.ccs/glm.settings.json`を編集してZ.AI Coding Plan APIキーを追加
> - **GLMT**: `~/.ccs/glmt.settings.json`を編集してZ.AI Coding Plan APIキーを追加
> - **Kimi**: `~/.ccs/kimi.settings.json`を編集してKimi APIキーを追加

<br>

**並列ワークフロー：計画 + 実行**

```bash
# Terminal 1 - 計画（Claude Sonnet）
ccs "認証とレート制限付きREST APIの計画"

# Terminal 2 - 実行（GLM、コスト最適化）
ccs glm "計画からユーザー認証エンドポイントを実装"
```

<details>
<summary><strong>思考モデル（Kimi & GLMT）</strong></summary>

<br>

```bash
# Kimi - 安定した思考サポート
ccs kimi "トレードオフ分析付きキャッシュ戦略の設計"

# GLMT - 実験的（詳細は下記参照）
ccs glmt "推論ステップ付き複雑なアルゴリズムのデバッグ"
```

**注**: GLMTは実験的で不安定です。詳細については下記の[GLM with Thinking (GLMT)](#glm-with-thinking-glmt)セクションを参照してください。

</details>

<br>

## 開発者の日常的な課題

<div align="center">

### **切り替えを停止。調整を開始。**

**セッション制限がフロー状態を殺すべきではありません。**
</div>

実装に深く集中しています。コンテキストが読み込まれました。解決策が結晶化しています。<br>
その後: 🔴 _"使用制限に達しました。"_

**モチベーションが失われました。コンテキストが失われました。生産性が崩壊しました。**

## **解決策：並列ワークフロー**

<details>
<summary><strong>❌ 古い方法：</strong> 制限に達した時に切り替える（反応的）</summary>

### 現在のワークフロー：
- **14時:** 機能開発、ゾーン状態
- **15時:** 🔴 使用制限に達した
- **15:05:** 作業停止、`~/.claude/settings.json`を編集
- **15:15:** アカウント切り替え、コンテキストが失われる
- **15:30:** フロー状態に戻ろうと試みる
- **16時:** ついに生産性が回復

- **結果:** 1時間失われ、モチベーションが破壊され、不満が蓄積

</details>

<details open>
<summary><strong>✨ 新しい方法：</strong> 最初から並列で実行（主導的） - <strong>推奨</strong></summary>

### 新しいワークフロー：
- **14時:** **ターミナル1:** `ccs "APIアーキテクチャを計画"` → 戦略的思考（Claude Pro）
- **14時:** **ターミナル2:** `ccs glm "エンドポイントを実装"` → コード実行（GLM）
- **15時:** まだ開発継続、割れなし
- **16時:** フロー状態達成、生産性急上昇
- **17時:** 機能が完了、コンテキスト維持

- **結果:** ダウムタイムなし、継続的生産性、不満減少

### 💰 **価値提案:**
- **設定:** 既存のClaude Pro + GLM Lite（費用対効果の高い追加）
- **価値:** 1時間/日 × 20労働日 = 20時間/月を回収
- **ROI:** 開発時間は設定コスト以上の価値がある
- **現実:** オーバーヘッドより速く出荷

</details>

## あなたの道を選択

<details>
<summary><strong>予算重視：</strong> GLMのみ</summary>

- **最適:** 費用意識の高い開発、基本的なコード生成
- **使用法:** 費用効果の高いAI支援のために`ccs glm`を直接使用
- **現実:** Claudeアクセスなし、多くのコーディングタスクに対応可能
- **設定:** GLM APIキーのみ、非常に手頃

</details>

<details open>
<summary><strong>✨ 日々の開発に推奨：</strong> 1 Claude Pro + 1 GLM Lite</summary>

- **最適:** 日々のコードデリバリー、真剣な開発作業
- **使用法:** `ccs`で計画 + `ccs glm`で実行（並列ワークフロー）
- **現実:** ほとんどの開発者にとって能力と費用の完璧なバランス
- **価値:** セッション制限に達せず、継続的生産性

</details>

<details>
<summary><strong>パワーユーザー：</strong> 複数のClaude Pro + GLM Pro</summary>

- **最適:** 重い作業量、並行プロジェクト、ソロ開発
- **解放:** セッション・週次制限を決して枯渇させない
- **ワークフロー:** 3+以上のターミナルで専門タスクを同時実行

</details>

<details>
<summary><strong>プライバシー重視：</strong> 仕事/個人の分離</summary>

- **必要時:** 仕事と個人AIコンテキストの厳格な分離
- **設定:** `ccs auth create work` + `ccs auth create personal`
- **注意:** 高度な機能 - ほとんどのユーザーには不要

</details>

---

## 手動切り替えではなくCCSを使う理由は？

<div align="center">

**CCSは「午後3時に制限に達したら切り替える」ことではありません。**

## **それは最初から並列で実行することです。**

</div>

### コアな違い

| **手動切り替え** | **CCSオーケストレーション** |
|:---|:---|
| 🔴 制限達成 → 作業停止 → 設定ファイル編集 → 再起動 | ✅ 最初から異なるモデルで複数ターミナルを実行 |
| 😰 コンテキストロスとフロー状態中断 | 😌 コンテキスト維持での継続的生産性 |
| 📝 逐次的タスク処理 | ⚡ 並列ワークフロー（計画 + 実行を同時に） |
| 🛠️ ブロックされた時の反応的問題解決 | 🎯 ブロックを防ぐ主導的ワークフロー設計 |

### CCSが提供するもの

- **ゼロコンテキスト切り替え:** 割れずにフロー状態を維持
- **並列生産性:** 1ターミナルで戦略計画、もう1つでコード実行
- **即座アカウント管理:** 1コマンド切り替え、設定ファイル編集不要
- **仕事と生活の分離:** ログアウトせずにコンテキストを分離
- **クロスプラットフォーム一貫性:** macOS、Linux、Windowsで同じスムーズな体験

<br>

## アーキテクチャ

### プロファイルタイプ

**設定ベース**: GLM, GLMT, Kimi, default
- 設定ファイルを指す`--settings`フラグを使用
- GLMT: 思考モードサポートの埋め込みプロキシ

**アカウントベース**: work, personal, team
- 分離されたインスタンスに`CLAUDE_CONFIG_DIR`を使用
- `ccs auth create <profile>`で作成

### 共有データ（v3.1）

コマンドとスキルは`~/.ccs/shared/`からシンボリックリンク - プロファイル間の重複なし。

```plaintext
~/.ccs/
├── shared/                  # すべてのプロファイルで共有
│   ├── agents/
│   ├── commands/
│   └── skills/
├── instances/               # プロファイル固有のデータ
│   └── work/
│       ├── agents@ → shared/agents/
│       ├── commands@ → shared/commands/
│       ├── skills@ → shared/skills/
│       ├── settings.json    # APIキー、認証情報
│       ├── sessions/        # 会話履歴
│       └── ...
```

| タイプ | ファイル |
|:-----|:------|
| **共有** | `commands/`, `skills/`, `agents/` |
| **プロファイル固有** | `settings.json`, `sessions/`, `todolists/`, `logs/` |

> [!NOTE]
> **Windows**: シンボリックリンクが利用できない場合はディレクトリをコピー（本物のシンボリックリンクには開発者モードを有効にしてください）

<br>

## 使用例

### 基本的な切り替え

```bash
ccs              # Claudeサブスクリプション（デフォルト）
ccs glm          # GLM（コスト最適化）
ccs kimi         # Kimi（思考サポート付き）
```

### マルチアカウント設定

```bash
# アカウントを作成
ccs auth create work
ccs auth create personal
```

**別々のターミナルで同時に実行：**

```bash
# Terminal 1 - 業務用
ccs work "機能を実装"

# Terminal 2 - 個人用（同時）
ccs personal "コードレビュー"
```

### ヘルプとバージョン

```bash
ccs --version    # バージョンを表示
ccs --help       # すべてのコマンドとオプションを表示
```

<br>

## GLM with Thinking (GLMT)

> [!CAUTION]
> ### 本番環境未対応 - 実験的機能
>
> **GLMTは実験的で広範なデバッグが必要です**：
> - ストリーミングとツールサポートはまだ開発中
> - 予期せぬエラー、タイムアウト、不完全な応答が発生する可能性
> - 頻繁なデバッグと手動介入が必要
> - **重要なワークフローや本番使用には推奨されません**
>
> **GLM Thinkingの代替案**: **CCR hustle**と**BedollaのTransformer**（[ZaiTransformer](https://github.com/Bedolla/ZaiTransformer/)）を通じて、より安定した実装を検討してください。

> [!IMPORTANT]
> GLMTはnpmインストールが必要です（`npm install -g @kaitranntt/ccs`）。ネイティブシェルバージョンでは利用できません（Node.js HTTPサーバーが必要）。

<br>

> [!NOTE]
> ### 謝辞：GLMTを可能にした基盤
>
> **CCSのGLMT実装は、[@Bedolla](https://github.com/Bedolla)の画期的な仕事に存在を負っています**。彼は[Claude Code Router (CCR)](https://github.com/musistudio/claude-code-router)とZ.AIの推論能力をブリッジする[最初の統合](https://github.com/Bedolla/ZaiTransformer/)を作成しました。
>
> ZaiTransformer以前、誰もZ.AIの思考モードとClaude Codeのワークフローを正常に統合できませんでした。Bedollaの仕事は単なる有用なものではなく、**基盤的**でした。彼のリクエスト/レスポンストランスフォーメーションアーキテクチャ、思考モード制御メカニズム、埋め込みプロキシ設計の実装は、GLMTの設計に直接インスピレーションを与え、可能にしました。
>
> **ZaiTransformerの先駆的な仕事なしでは、GLMTは現在の形では存在しませんでした。** GLMTの思考能力から利益を得る場合は、Claude Codeエコシステムでの先駆的な仕事をサポートするために[ZaiTransformer](https://github.com/Bedolla/ZaiTransformer/)にスターを付けてください。

<br>

<details>
<summary><h3>GLM vs GLMT 比較</h3></summary>

<br>

<div align="center">

| 機能 | GLM (`ccs glm`) | GLMT (`ccs glmt`) |
|:--------|:----------------|:------------------|
| **エンドポイント** | Anthropic互換 | OpenAI互換 |
| **思考** | なし | 実験的（reasoning_content） |
| **ツールサポート** | 基本的 | **不安定（v3.5+）** |
| **MCPツール** | 制限あり | **バグあり（v3.5+）** |
| **ストリーミング** | 安定 | **実験的（v3.4+）** |
| **TTFB** | <500ms | <500ms（時々）、2-10秒+（頻繁） |
| **使用例** | 信頼性の高い作業 | **デバッグ実験のみ** |

</div>

</details>

<br>

<details>
<summary><h3>ツールサポート（v3.5） - 実験的</h3></summary>

<br>

**GLMTはMCPツールと関数呼び出しを試行：**

- **双方向トランスフォーメーション**: Anthropicツール ↔ OpenAI形式（不安定）
- **MCP統合**: MCPツールが時々実行（多くの場合XMLガベージを出力）
- **ストリーミングツール呼び出し**: リアルタイムツール呼び出し（クラッシュしない場合）
- **後方互換**: 既存の思考サポートを破壊する可能性
- **設定が必要**: 頻繁な手動デバッグが必要

</details>

<details>
<summary><h3>ストリーミングサポート（v3.4） - しばしば失敗</h3></summary>

<br>

**GLMTは増分推論コンテンツ配信でリアルタイムストリーミングを試行：**

- **デフォルト**: ストリーミング有効（動作時TTFB <500ms）
- **自動フォールバック**: エラーにより頻繁にバッファモードに切り替え
- **思考パラメータ**: Claude CLI `thinking`パラメータが時々動作
  - `thinking.type`と`budget_tokens`を無視する場合
  - 優先順位: CLIパラメータ > メッセージタグ > デフォルト（破壊されていない場合）

**ステータス**: Z.AI（テスト済み、ツール呼び出しが頻繁に破壊、継続的なデバッグが必要）

</details>

<details>
<summary><h3>動作原理（動作時）</h3></summary>

<br>

1. CCSがlocalhostに埋め込みHTTPプロキシを生成（クラッシュしない場合）
2. プロキシがAnthropic形式 → OpenAI形式への変換を試行（多くの場合失敗）
3. Anthropicツール → OpenAI関数呼び出し形式への変換を試行（バグあり）
4. 推論パラメータとツールを付けてZ.AIに転送（タイムアウトしない場合）
5. `reasoning_content` → 思考ブロックへの変換を試行（部分的または破壊）
6. OpenAI `tool_calls` → Anthropic `tool_use` ブロックへの変換を試行（XMLガベージが一般的）
7. 思考とツール呼び出しが時々Claude Code UIに表示（破壊されていない場合）

</details>

<details>
<summary><h3>制御タグとキーワード</h3></summary>

<br>

**制御タグ**:
- `<Thinking:On|Off>` - 推論ブロックの有効/無効（デフォルト: On）
- `<Effort:Low|Medium|High>` - 推論深度の制御（非推奨 - Z.AIはバイナリ思考のみサポート）

**思考キーワード**（不安定なアクティベーション）:
- `think` - 時々推論を有効化（低労力）
- `think hard` - 時々推論を有効化（中労力）
- `think harder` - 時々推論を有効化（高労力）
- `ultrathink` - 最大推論深度を試行（多くの場合破壊）

</details>

<details>
<summary><h3>環境変数</h3></summary>

<br>

**GLMT機能**（すべて実験的）:
- 強制的な英語出力強制（時々動作）
- ランダムな思考モードアクティベーション（予測不可能）
- 頻繁なバッファモードへのフォールバック付きストリーミング試行

**一般**:
- `CCS_DEBUG_LOG=1` - デバッグファイルロギングを有効化
- `CCS_CLAUDE_PATH=/path/to/claude` - カスタムClaude CLIパス

</details>

<details>
<summary><h3>APIキー設定</h3></summary>

<br>

```bash
# GLMT設定を編集
nano ~/.ccs/glmt.settings.json
```

Z.AI APIキーを設定（コーディングプランが必要）：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-z-ai-api-key"
  }
}
```

</details>

<details>
<summary><h3>セキュリティ制限（DoS保護）</h3></summary>

<br>

**v3.4 保護制限**:

| 制限 | 値 | 目的 |
|:------|:------|:--------|
| **SSEバッファ** | イベントあたり最大1MB | バッファオーバーフローを防止 |
| **コンテンツバッファ** | ブロックあたり最大10MB | 思考/テキストブロックを制限 |
| **コンテンツブロック** | メッセージあたり最大100 | DoS攻撃を防止 |
| **リクエストタイムアウト** | 120秒 | ストリーミングとバッファの両方 |

</details>

<details>
<summary><h3>デバッグ</h3></summary>

<br>

**詳細ロギングを有効化**:
```bash
ccs glmt --verbose "your prompt"
```

**デバッグファイルロギングを有効化**:
```bash
export CCS_DEBUG_LOG=1
ccs glmt --verbose "your prompt"
# ログ: ~/.ccs/logs/
```

**GLMTデバッグ**:
```bash
# 詳細ロギングでストリーミングステータスと推論詳細を表示
ccs glmt --verbose "test"
```

**推論コンテンツを確認**:
```bash
cat ~/.ccs/logs/*response-openai.json | jq '.choices[0].message.reasoning_content'
```

**トラブルシューティング**:
- **存在しない場合**: Z.AI APIの問題（キー、アカウントステータスを確認）
- **存在する場合**: トランスフォーメーションの問題（`response-anthropic.json`を確認）

</details>

<br>

## アンインストール

<details>
<summary><h3>パッケージマネージャー</h3></summary>

<br>

```bash
# npm
npm uninstall -g @kaitranntt/ccs

# yarn
yarn global remove @kaitranntt/ccs

# pnpm
pnpm remove -g @kaitranntt/ccs

# bun
bun remove -g @kaitranntt/ccs
```

</details>

<details>
<summary><h3>公式アンインストーラー</h3></summary>

<br>

```bash
# macOS / Linux
curl -fsSL ccs.kaitran.ca/uninstall | bash

# Windows PowerShell
irm ccs.kaitran.ca/uninstall | iex
```

</details>

<br>

## 🎯 哲学

- **YAGNI**: 「念のため」の機能は追加しない
- **KISS**: シンプルなbash、複雑さなし
- **DRY**: 単一の情報源（設定）

## 📖 ドキュメント

**[docs/](./docs/)の完全なドキュメント**:
- [インストールガイド](./docs/en/installation.md)
- [設定](./docs/en/configuration.md)
- [使用例](./docs/en/usage.md)
- [システムアーキテクチャ](./docs/system-architecture.md)
- [GLMT制御メカニズム](./docs/glmt-controls.md)
- [トラブルシューティング](./docs/en/troubleshooting.md)
- [貢献](./CONTRIBUTING.md)

## 🤝 貢献

貢献を歓迎します！詳細については[貢献ガイド](./CONTRIBUTING.md)をご覧ください。

## Star History

<div align="center">

<img src="https://api.star-history.com/svg?repos=kaitranntt/ccs&type=timeline&logscale&legend=top-left" alt="Star History Chart" width="800">

</div>


## ライセンス

CCSは[MITライセンス](LICENSE)の下でライセンスされています。

<div align="center">

**レート制限に頻繁に遭遇する開発者のために ❤️ を込めて作成**

[⭐ このリポジトリにスター](https://github.com/kaitranntt/ccs) | [🐛 問題を報告](https://github.com/kaitranntt/ccs/issues) | [📖 ドキュメントを読む](./docs/en/)

</div>