<div align="center">

# CCS - Claude Code Switch

![CCS Logo](../../docs/assets/ccs-logo-medium.png)

### Một lệnh, không downtime, nhiều tài khoản

**Chuyển đổi giữa nhiều tài khoản Claude, GLM, và Kimi ngay lập tức.**
Ngừng hitting rate limits. Làm việc liên tục.

<br>

[![License](https://img.shields.io/badge/license-MIT-C15F3C?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey?style=for-the-badge)]()
[![npm](https://img.shields.io/npm/v/@kaitranntt/ccs?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@kaitranntt/ccs)
[![PoweredBy](https://img.shields.io/badge/PoweredBy-ClaudeKit-C15F3C?style=for-the-badge)](https://claudekit.cc?ref=HMNKXOHN)

**Languages**: [English](../../README.md) · [Tiếng Việt](README.md) · [日本語](../ja/README.md)

</div>

<br>

## Bắt Đầu Nhanh

### Cài Đặt

**npm Package (Được khuyến nghị)**

**macOS / Linux / Windows**
```bash
npm install -g @kaitranntt/ccs
```

**Tất cả các trình quản lý package chính đều được hỗ trợ:**

```bash
# yarn
yarn global add @kaitranntt/ccs

# pnpm (ít hơn 70% dung lượng đĩa)
pnpm add -g @kaitranntt/ccs

# bun (nhanh hơn 30x)
bun add -g @kaitranntt/ccs
```

<details>
<summary><strong>[!] LỖI THỜI: Trình cài đặt shell gốc (Cũ)</strong></summary>

<br>

> [!WARNING]
> **Các trình cài đặt này đã lỗi thời và sẽ bị xóa trong phiên bản tương lai.**
> Hiện tại chúng tự động chuyển hướng đến cài đặt npm. Vui lòng sử dụng npm trực tiếp.

**macOS / Linux**
```bash
curl -fsSL ccs.kaitran.ca/install | bash
```

**Windows PowerShell**
```powershell
irm ccs.kaitran.ca/install | iex
```

**Lưu ý**: Script hiển thị cảnh báo lỗi thời và tự động chạy cài đặt npm nếu Node.js khả dụng.

</details>

<br>

### Cấu Hình (Tự Tạo)

**CCS tự động tạo cấu hình trong quá trình cài đặt** (thông qua script postinstall của npm).

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
<summary><h3>Custom Claude CLI Path</h3></summary>

<br>

Nếu Claude CLI được cài đặt ở vị trí không chuẩn (ổ D, thư mục tùy chỉnh), đặt `CCS_CLAUDE_PATH`:

```bash
# Unix/Linux/macOS
export CCS_CLAUDE_PATH="/path/to/claude"

# Windows PowerShell
$env:CCS_CLAUDE_PATH = "D:\Tools\Claude\claude.exe"
```

**Xem thêm**: [Hướng dẫn Khắc phục Sự cố](./docs/en/troubleshooting.md#claude-cli-in-non-standard-location) để biết chi tiết cài đặt.

</details>

<details>
<summary><h3>Windows Symlink Support (Developer Mode)</h3></summary>

<br>

**Người dùng Windows**: Bật Chế độ Nhà phát triển để có symlink thực sự (hiệu suất tốt hơn, đồng bộ hóa tức thì):

1. Mở **Settings** → **Privacy & Security** → **For developers**
2. Bật **Developer Mode**
3. Cài đặt lại CCS: `npm install -g @kaitranntt/ccs`

**Cảnh báo**: Nếu không có Chế độ Nhà phát triển, CCS tự động chuyển sang sao chép thư mục (hoạt động nhưng không đồng bộ tức thì trên các profile).

</details>

<br>

### Lần Chuyển Đổi Đầu Tiên

> [!IMPORTANT]
> **Trước khi dùng các mô hình thay thế, cập nhật API keys trong file settings:**
>
> - **GLM**: Chỉnh sửa `~/.ccs/glm.settings.json` và thêm Z.AI Coding Plan API Key của bạn
> - **GLMT**: Chỉnh sửa `~/.ccs/glmt.settings.json` và thêm Z.AI Coding Plan API Key của bạn
> - **Kimi**: Chỉnh sửa `~/.ccs/kimi.settings.json` và thêm Kimi API key của bạn

<br>

**Parallel Workflow: Planning + Execution**

```bash
# Terminal 1 - Planning (Claude Sonnet)
ccs "Plan a REST API with authentication and rate limiting"

# Terminal 2 - Execution (GLM, cost-optimized)
ccs glm "Implement the user authentication endpoints from the plan"
```

<details>
<summary><strong>Thinking Models (Kimi & GLMT)</strong></summary>

<br>

```bash
# Kimi - Stable thinking support
ccs kimi "Design a caching strategy with trade-off analysis"

# GLMT - Experimental (see full disclaimer below)
ccs glmt "Debug complex algorithm with reasoning steps"
```

**Lưu ý:** GLMT là thử nghiệm và không ổn định. Xem phần [GLM with Thinking (GLMT)](#glm-with-thinking-glmt) dưới đây để biết chi tiết.

</details>

<br>

## The Daily Developer Pain Point

<div align="center">

### **DỪNG việc chuyển đổi. BẮT ĐẦU điều phối.**

**Giới hạn phiên không nên phá hỏng trạng thái dòng chảy của bạn.**
</div>

Bạn đang sâu trong triển khai. Ngữ cảnh đã tải. Giải pháp đang kết tinh.<br>
Sau đó: 🔴 _"Bạn đã đạt đến giới hạn sử dụng."_

**Động lực mất đi. Ngữ cảnh mất. Năng suất sụp đổ.**

## **Giải pháp: Quy trình công việc song song**

<details>
<summary><strong>❌ CÁCH CŨ:</strong> Chuyển đổi khi bạn đạt đến giới hạn (Phản ứng)</summary>

### Quy trình làm việc hiện tại của bạn:
- **2pm:** Xây dựng tính năng, trong vùng
- **3pm:** 🔴 Đạt giới hạn sử dụng
- **3:05pm:** Dừng công việc, chỉnh sửa `~/.claude/settings.json`
- **3:15pm:** Chuyển tài khoản, mất ngữ cảnh
- **3:30pm:** Cố gắng quay lại trạng thái dòng chảy
- **4pm:** Cuối cùng cũng năng suất trở lại

- **Kết quả:** Mất 1 giờ, động lực bị phá hủy, sự thất vọng tăng lên

</details>

<details open>
<summary><strong>✨ CÁCH MỚI:</strong> Chạy song song ngay từ đầu (Chủ động) - <strong>ĐƯỢC KHUYÊN NGHỊ</strong></summary>

### Quy trình làm việc mới của bạn:
- **2pm:** **Terminal 1:** `ccs "Lập kế hoạch kiến trúc API"` → Tư duy chiến lược (Claude Pro)
- **2pm:** **Terminal 2:** `ccs glm "Triển khai các điểm cuối API"` → Thực thi mã (GLM)
- **3pm:** Vẫn đang giao hàng, không có gián đoạn
- **4pm:** Đạt trạng thái dòng chảy, năng suất tăng vọt
- **5pm:** Tính năng đã giao hàng, ngữ cảnh được duy trì

- **Kết quả:** Không có thời gian chết, năng suất liên tục, ít thất vọng hơn

### 💰 **Giá trị đề xuất:**
- **Thiết lập:** Claude Pro hiện tại của bạn + GLM Lite (add-on hiệu quả về chi phí)
- **Giá trị:** Tiết kiệm 1 giờ/ngày × 20 ngày làm việc = 20 giờ/tháng được phục hồi
- **ROI:** Thời gian phát triển của bạn có giá trị hơn chi phí thiết lập
- **Thực tế:** Giao hàng nhanh hơn chi phí vận hành

</details>

## Chọn con đường của bạn

<details>
<summary><strong>Tập trung vào ngân sách:</strong> Chỉ GLM</summary>

- **Tốt nhất cho:** Phát triển tiết kiệm chi phí, tạo mã cơ bản
- **Sử dụng:** Chỉ sử dụng `ccs glm` trực tiếp để được trợ giúp AI hiệu quả về chi phí
- **Thực tế:** Không có quyền truy cập Claude, nhưng có khả năng cho nhiều nhiệm vụ mã hóa
- **Thiết lập:** Chỉ cần API key GLM, rất phải chăng

</details>

<details open>
<summary><strong>✨ Được khuyên nghị cho phát triển hàng ngày:</strong> 1 Claude Pro + 1 GLM Lite</summary>

- **Tốt nhất cho:** Giao hàng mã hàng ngày, công việc phát triển nghiêm túc
- **Sử dụng:** `ccs` để lập kế hoạch + `ccs glm` để thực thi (quy trình công việc song song)
- **Thực tế:** Cân bằng hoàn hảo giữa khả năng và chi phí cho hầu hết các nhà phát triển
- **Giá trị:** Không bao giờ đạt đến giới hạn phiên, năng suất liên tục

</details>

<details>
<summary><strong>Power User:</strong> Nhiều Claude Pro + GLM Pro</summary>

- **Tốt nhất cho:** Nhiều công việc, dự án đồng thời, solo dev
- **Mở khóa:** Không bao giờ cạn kiệt giới hạn phiên hoặc hàng tuần
- **Quy trình làm việc:** 3+ terminal chạy các nhiệm vụ chuyên biệt đồng thời

</details>

<details>
<summary><strong>Tập trung vào quyền riêng tư:</strong> Cách ly Công việc/Cá nhân</summary>

- **Khi cần:** Cách ly nghiêm ngặt ngữ cảnh AI công việc và cá nhân
- **Thiết lập:** `ccs auth create work` + `ccs auth create personal`
- **Lưu ý:** Tính năng nâng cao - hầu hết người dùng không cần điều này

</details>

---

## Why CCS Instead of Manual Switching?

<div align="center">

**CCS không phải về "chuyển đổi khi bạn đạt đến giới hạn lúc 3pm."**

## **Nó về việc chạy song song ngay từ đầu.**

</div>

### Sự khác biệt cốt lõi

| **Chuyển đổi thủ công** | **Điều phối CCS** |
|:---|:---|
| 🔴 Đạt giới hạn → Dừng công việc → Chỉnh sửa tệp cấu hình → Khởi động lại | ✅ Nhiều terminal chạy các mô hình khác nhau ngay từ đầu |
| 😰 Mất ngữ cảnh và gián đoạn trạng thái dòng chảy | 😌 Năng suất liên tục với ngữ cảnh được bảo toàn |
| 📝 Xử lý nhiệm vụ tuần tự | ⚡ Quy trình công việc song song (lập kế hoạch + thực thi đồng thời) |
| 🛠️ Giải quyết vấn đề phản ứng khi bị chặn | 🎯 Thiết kế quy trình công việc chủ động ngăn chặn chặn |

### CCS mang lại cho bạn

- **Không chuyển đổi ngữ cảnh:** Duy trì trạng thái dòng chảy của bạn mà không bị gián đoạn
- **Năng suất song song:** Lập kế hoạch chiến lược trong một terminal, thực thi mã trong terminal khác
- **Quản lý tài khoản tức thì:** Một lệnh chuyển đổi, không cần chỉnh sửa tệp cấu hình
- **Cách ly công việc-cuộc sống:** Cách ly ngữ cảnh mà không cần đăng xuất
- **Tính nhất quán đa nền tảng:** Trải nghiệm mượt mà tương tự trên macOS, Linux, Windows

<br>

## Architecture

### Profile Types

**Settings-based**: GLM, GLMT, Kimi, default
- Uses `--settings` flag pointing to config files
- GLMT: Embedded proxy for thinking mode support

**Account-based**: work, personal, team
- Uses `CLAUDE_CONFIG_DIR` for isolated instances
- Create with `ccs auth create <profile>`

### Shared Data (v3.1)

Commands and skills symlinked from `~/.ccs/shared/` - **no duplication across profiles**.

```plaintext
~/.ccs/
├── shared/                  # Shared across all profiles
│   ├── agents/
│   ├── commands/
│   └── skills/
├── instances/               # Profile-specific data
│   └── work/
│       ├── agents@ → shared/agents/
│       ├── commands@ → shared/commands/
│       ├── skills@ → shared/skills/
│       ├── settings.json    # API keys, credentials
│       ├── sessions/        # Conversation history
│       └── ...
```

| Type | Files |
|:-----|:------|
| **Shared** | `commands/`, `skills/`, `agents/` |
| **Profile-specific** | `settings.json`, `sessions/`, `todolists/`, `logs/` |

> [!NOTE]
> **Windows**: Copies directories if symlinks unavailable (enable Developer Mode for true symlinks)

<br>

## Usage Examples

### Basic Switching

```bash
ccs              # Claude subscription (default)
ccs glm          # GLM (cost-optimized)
ccs kimi         # Kimi (with thinking support)
```

### Multi-Account Setup

```bash
# Create accounts
ccs auth create work
ccs auth create personal
```

**Run concurrently in separate terminals:**

```bash
# Terminal 1 - Work
ccs work "implement feature"

# Terminal 2 - Personal (concurrent)
ccs personal "review code"
```

### Help & Version

```bash
ccs --version    # Show version
ccs --help       # Show all commands and options
```

<br>

## GLM with Thinking (GLMT)

> [!CAUTION]
> ### NOT PRODUCTION READY - EXPERIMENTAL FEATURE
>
> **GLMT is experimental and requires extensive debugging**:
> - Streaming and tool support still under active development
> - May experience unexpected errors, timeouts, or incomplete responses
> - Requires frequent debugging and manual intervention
> - **Not recommended for critical workflows or production use**
>
> **Alternative for GLM Thinking**: Consider going through the **CCR hustle** with the **Transformer of Bedolla** ([ZaiTransformer](https://github.com/Bedolla/ZaiTransformer/)) for a more stable implementation.

> [!IMPORTANT]
> GLMT requires npm installation (`npm install -g @kaitranntt/ccs`). Not available in native shell versions (requires Node.js HTTP server).

<br>

> [!NOTE]
> ### Acknowledgments: The Foundation That Made GLMT Possible
>
> **CCS's GLMT implementation owes its existence to the groundbreaking work of [@Bedolla](https://github.com/Bedolla)**, who created [ZaiTransformer](https://github.com/Bedolla/ZaiTransformer/) - the **first integration** to bridge [Claude Code Router (CCR)](https://github.com/musistudio/claude-code-router) with Z.AI's reasoning capabilities.
>
> Before ZaiTransformer, no one had successfully integrated Z.AI's thinking mode with Claude Code's workflow. Bedolla's work wasn't just helpful - it was **foundational**. His implementation of request/response transformation architecture, thinking mode control mechanisms, and embedded proxy design directly inspired and enabled GLMT's design.
>
> **Without ZaiTransformer's pioneering work, GLMT wouldn't exist in its current form.** If you benefit from GLMT's thinking capabilities, please consider starring [ZaiTransformer](https://github.com/Bedolla/ZaiTransformer/) to support pioneering work in the Claude Code ecosystem.

<br>

<details>
<summary><h3>GLM vs GLMT Comparison</h3></summary>

<br>

<div align="center">

| Feature | GLM (`ccs glm`) | GLMT (`ccs glmt`) |
|:--------|:----------------|:------------------|
| **Endpoint** | Anthropic-compatible | OpenAI-compatible |
| **Thinking** | No | Experimental (`reasoning_content`) |
| **Tool Support** | Basic | **Unstable (v3.5+)** |
| **MCP Tools** | Limited | **Buggy (v3.5+)** |
| **Streaming** | Stable | **Experimental (v3.4+)** |
| **TTFB** | <500ms | <500ms (sometimes), 2-10s+ (often) |
| **Use Case** | Reliable work | **Debugging experiments only** |

</div>

</details>

<br>

<details>
<summary><h3>Tool Support (v3.5) - EXPERIMENTAL</h3></summary>

<br>

**GLMT attempts MCP tools and function calling:**

- **Bidirectional Transformation**: Anthropic tools ↔ OpenAI format (unstable)
- **MCP Integration**: MCP tools sometimes execute (often output XML garbage)
- **Streaming Tool Calls**: Real-time tool calls (when not crashing)
- **Backward Compatible**: May break existing thinking support
- **Configuration Required**: Frequent manual debugging needed

</details>

<details>
<summary><h3>Streaming Support (v3.4) - OFTEN FAILS</h3></summary>

<br>

**GLMT attempts real-time streaming** with incremental reasoning content delivery:

- **Default**: Streaming enabled (TTFB <500ms when it works)
- **Auto-fallback**: Frequently switches to buffered mode due to errors
- **Thinking parameter**: Claude CLI `thinking` parameter sometimes works
  - May ignore `thinking.type` and `budget_tokens`
  - Precedence: CLI parameter > message tags > default (when not broken)

**Status**: Z.AI (tested, tool calls frequently break, requires constant debugging)

</details>

<details>
<summary><h3>How It Works (When It Works)</h3></summary>

<br>

1. CCS spawns embedded HTTP proxy on localhost (if not crashing)
2. Proxy attempts to convert Anthropic format → OpenAI format (often fails)
3. Tries to transform Anthropic tools → OpenAI function calling format (buggy)
4. Forwards to Z.AI with reasoning parameters and tools (when not timing out)
5. Attempts to convert `reasoning_content` → thinking blocks (partial or broken)
6. Attempts to convert OpenAI `tool_calls` → Anthropic `tool_use` blocks (XML garbage common)
7. Thinking and tool calls sometimes appear in Claude Code UI (when not broken)

</details>

<details>
<summary><h3>Control Tags & Keywords</h3></summary>

<br>

**Control Tags**:
- `<Thinking:On|Off>` - Enable/disable reasoning blocks (default: On)
- `<Effort:Low|Medium|High>` - Control reasoning depth (deprecated - Z.AI only supports binary thinking)

**Thinking Keywords** (inconsistent activation):
- `think` - Sometimes enables reasoning (low effort)
- `think hard` - Sometimes enables reasoning (medium effort)
- `think harder` - Sometimes enables reasoning (high effort)
- `ultrathink` - Attempts maximum reasoning depth (often breaks)

</details>

<details>
<summary><h3>Environment Variables</h3></summary>

<br>

**GLMT features** (all experimental):
- Forced English output enforcement (sometimes works)
- Random thinking mode activation (unpredictable)
- Attempted streaming with frequent fallback to buffered mode

**General**:
- `CCS_DEBUG_LOG=1` - Enable debug file logging
- `CCS_CLAUDE_PATH=/path/to/claude` - Custom Claude CLI path

</details>

<details>
<summary><h3>API Key Setup</h3></summary>

<br>

```bash
# Edit GLMT settings
nano ~/.ccs/glmt.settings.json
```

Set Z.AI API key (requires coding plan):

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-z-ai-api-key"
  }
}
```

</details>

<details>
<summary><h3>Security Limits (DoS Protection)</h3></summary>

<br>

**v3.4 Protection Limits**:

| Limit | Value | Purpose |
|:------|:------|:--------|
| **SSE buffer** | 1MB max per event | Prevent buffer overflow |
| **Content buffer** | 10MB max per block | Limit thinking/text blocks |
| **Content blocks** | 100 max per message | Prevent DoS attacks |
| **Request timeout** | 120s | Both streaming and buffered |

</details>

<details>
<summary><h3>Debugging</h3></summary>

<br>

**Enable verbose logging**:
```bash
ccs glmt --verbose "your prompt"
```

**Enable debug file logging**:
```bash
export CCS_DEBUG_LOG=1
ccs glmt --verbose "your prompt"
# Logs: ~/.ccs/logs/
```

**GLMT debugging**:
```bash
# Verbose logging shows streaming status and reasoning details
ccs glmt --verbose "test"
```

**Check reasoning content**:
```bash
cat ~/.ccs/logs/*response-openai.json | jq '.choices[0].message.reasoning_content'
```

**Troubleshooting**:
- **If absent**: Z.AI API issue (verify key, account status)
- **If present**: Transformation issue (check `response-anthropic.json`)

</details>

<br>

## Uninstall

<details>
<summary><h3>Package Managers</h3></summary>

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
<summary><h3>Official Uninstaller</h3></summary>

<br>

```bash
# macOS / Linux
curl -fsSL ccs.kaitran.ca/uninstall | bash

# Windows PowerShell
irm ccs.kaitran.ca/uninstall | iex
```

</details>

<br>

## 🎯 Philosophy

- **YAGNI**: No features "just in case"
- **KISS**: Simple bash, no complexity
- **DRY**: One source of truth (config)

## 📖 Documentation

**Complete documentation in [docs/](./docs/)**:
- [Installation Guide](./docs/en/installation.md)
- [Configuration](./docs/en/configuration.md)
- [Usage Examples](./docs/en/usage.md)
- [System Architecture](./docs/system-architecture.md)
- [GLMT Control Mechanisms](./docs/glmt-controls.md)
- [Troubleshooting](./docs/en/troubleshooting.md)
- [Contributing](./CONTRIBUTING.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## Star History

<div align="center">

<img src="https://api.star-history.com/svg?repos=kaitranntt/ccs&type=timeline&logscale&legend=top-left" alt="Star History Chart" width="800">

</div>


## License

CCS is licensed under the [MIT License](LICENSE).

<div align="center">

**Made with ❤️ for developers who hit rate limits too often**

[⭐ Star this repo](https://github.com/kaitranntt/ccs) | [🐛 Report issues](https://github.com/kaitranntt/ccs/issues) | [📖 Read docs](./docs/en/)

</div>