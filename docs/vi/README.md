<div align="center">

# CCS - Claude Code Switch

![CCS Logo](../assets/ccs-logo-medium.png)

### Quản lý nhiều tài khoản AI từ một dashboard.
Chạy Claude, Gemini, GLM, và nhiều hơn nữa - đồng thời, không xung đột.

[![License](https://img.shields.io/badge/license-MIT-C15F3C?style=for-the-badge)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@kaitranntt/ccs?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@kaitranntt/ccs)
[![PoweredBy](https://img.shields.io/badge/PoweredBy-ClaudeKit-C15F3C?style=for-the-badge)](https://claudekit.cc?ref=HMNKXOHN)

**[Tính năng & Bảng giá](https://ccs.kaitran.ca)** | **[Tài liệu](../en/)** | [English](../../README.md) | [日本語](../ja/README.md)

</div>

<br>

## Ba Trụ Cột

| Khả năng | Chức năng | Quản lý qua |
|----------|-----------|-------------|
| **Nhiều Tài khoản Claude** | Chạy Claude công việc + cá nhân đồng thời | Dashboard |
| **Nhà cung cấp OAuth** | Gemini, Codex, Antigravity - không cần API key | Dashboard |
| **Hồ sơ API** | GLM, Kimi với API key của bạn | Dashboard |

<br>

## Bắt Đầu Nhanh

### 1. Cài Đặt

```bash
npm install -g @kaitranntt/ccs
```

<details>
<summary>Trình quản lý package khác</summary>

```bash
yarn global add @kaitranntt/ccs    # yarn
pnpm add -g @kaitranntt/ccs        # pnpm (tiết kiệm 70% dung lượng)
bun add -g @kaitranntt/ccs         # bun (nhanh hơn 30x)
```

</details>

### 2. Mở Dashboard

```bash
ccs config
# Mở http://localhost:3000
```

### 3. Cấu Hình Tài Khoản

Dashboard cung cấp giao diện quản lý trực quan cho tất cả loại tài khoản:

- **Tài khoản Claude**: Tạo các instance riêng biệt (công việc, cá nhân, khách hàng)
- **Nhà cung cấp OAuth**: Xác thực một cú nhấp cho Gemini, Codex, Antigravity
- **Hồ sơ API**: Cấu hình GLM, Kimi với key của bạn
- **Giám sát Sức khỏe**: Trạng thái thời gian thực cho tất cả profile

**Analytics (Giao diện Sáng/Tối)**

![Analytics Light](../assets/screenshots/analytics-light.png)

![Analytics Dark](../assets/screenshots/analytics.png)

**API Profiles & Nhà cung cấp OAuth**

![API Profiles](../assets/screenshots/api_profiles.png)

![CLIProxy](../assets/screenshots/cliproxy.png)

<br>

## Nhà Cung Cấp Được Hỗ Trợ

| Nhà cung cấp | Loại xác thực | Lệnh | Phù hợp nhất cho |
|--------------|---------------|------|------------------|
| **Claude** | Subscription | `ccs` | Mặc định, lập kế hoạch chiến lược |
| **Gemini** | OAuth | `ccs gemini` | Zero-config, lặp nhanh |
| **Codex** | OAuth | `ccs codex` | Tạo code |
| **Antigravity** | OAuth | `ccs agy` | Routing thay thế |
| **GLM** | API Key | `ccs glm` | Tối ưu chi phí |
| **Kimi** | API Key | `ccs kimi` | Long-context, thinking mode |

> **Nhà cung cấp OAuth** xác thực qua trình duyệt khi chạy lần đầu. Token được lưu cache tại `~/.ccs/cliproxy/auth/`.

<br>

## Sử Dụng

### Lệnh Cơ Bản

```bash
ccs           # Session Claude mặc định
ccs agy       # Antigravity (OAuth)
ccs gemini    # Gemini (OAuth)
ccs glm       # GLM (API key)
```

### Luồng Công Việc Song Song

Chạy nhiều terminal với các provider khác nhau:

```bash
# Terminal 1: Lập kế hoạch (Claude Pro)
ccs work "thiết kế hệ thống xác thực"

# Terminal 2: Thực thi (GLM - tối ưu chi phí)
ccs glm "triển khai user service theo kế hoạch"

# Terminal 3: Review (Gemini)
ccs gemini "review implementation về các lỗ hổng bảo mật"
```

### Multi-Account Claude

Tạo các instance Claude riêng biệt cho công việc/cá nhân:

```bash
ccs auth create work

# Chạy đồng thời trong các terminal riêng
ccs work "implement feature"    # Terminal 1
ccs "review code"               # Terminal 2 (tài khoản cá nhân)
```

<br>

## Bảo Trì

### Kiểm Tra Sức Khỏe

```bash
ccs doctor
```

Xác minh: Claude CLI, file cấu hình, symlinks, permissions.

### Cập Nhật

```bash
ccs update              # Cập nhật lên bản mới nhất
ccs update --force      # Cài đặt lại bắt buộc
ccs update --beta       # Cài đặt kênh dev
```

### Đồng Bộ Shared Items

```bash
ccs sync
```

Tạo lại symlinks cho commands, skills, và settings được chia sẻ.

<br>

## Cấu Hình

CCS tự động tạo config khi cài đặt. Dashboard là cách được khuyến nghị để quản lý settings.

**Vị trí config**: `~/.ccs/config.yaml`

<details>
<summary>Custom Claude CLI path</summary>

Nếu Claude CLI được cài đặt ở vị trí không chuẩn:

```bash
export CCS_CLAUDE_PATH="/path/to/claude"              # Unix
$env:CCS_CLAUDE_PATH = "D:\Tools\Claude\claude.exe"   # Windows
```

</details>

<details>
<summary>Hỗ trợ symlink Windows</summary>

Bật Developer Mode để có symlinks thực sự:

1. **Settings** → **Privacy & Security** → **For developers**
2. Bật **Developer Mode**
3. Cài đặt lại: `npm install -g @kaitranntt/ccs`

Không có Developer Mode, CCS sẽ fallback sang copy thư mục.

</details>

<br>

## Tài Liệu

| Chủ đề | Liên kết |
|--------|----------|
| Cài đặt | [docs/en/installation.md](../en/installation.md) |
| Cấu hình | [docs/en/configuration.md](../en/configuration.md) |
| Nhà cung cấp OAuth | [docs/en/oauth.md](../en/oauth.md) |
| Multi-Account Claude | [docs/en/multi-account.md](../en/multi-account.md) |
| Delegation | [docs/en/delegation.md](../en/delegation.md) |
| GLMT (Thử nghiệm) | [docs/en/glmt.md](../en/glmt.md) |
| Kiến trúc | [docs/system-architecture.md](../system-architecture.md) |
| Xử lý sự cố | [docs/en/troubleshooting.md](../en/troubleshooting.md) |

<br>

## Gỡ Cài Đặt

```bash
npm uninstall -g @kaitranntt/ccs
```

<details>
<summary>Trình quản lý package khác</summary>

```bash
yarn global remove @kaitranntt/ccs
pnpm remove -g @kaitranntt/ccs
bun remove -g @kaitranntt/ccs
```

</details>

<br>

## Triết Lý

- **YAGNI**: Không có tính năng "phòng hờ"
- **KISS**: Triển khai đơn giản, tập trung
- **DRY**: Một nguồn sự thật (config)

<br>

## Đóng Góp

Xem [CONTRIBUTING.md](../../CONTRIBUTING.md).

<br>

## Giấy Phép

MIT License - xem [LICENSE](../../LICENSE).

<div align="center">

---

**[ccs.kaitran.ca](https://ccs.kaitran.ca)** | [Báo cáo lỗi](https://github.com/kaitranntt/ccs/issues) | [Star trên GitHub](https://github.com/kaitranntt/ccs)

</div>
