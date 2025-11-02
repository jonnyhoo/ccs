# CCS - Claude Code Switch

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Language: Bash | PowerShell](https://img.shields.io/badge/Language-Bash%20%7C%20PowerShell-blue.svg)]()
[![Platform: macOS | Linux | Windows](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)]()

**Ngôn ngữ**: [English](README.md) | [Tiếng Việt](README.vi.md)

> Chuyển đổi giữa Claude Sonnet 4.5 và GLM 4.6 ngay lập tức. Dùng đúng model cho từng tác vụ.

**Vấn đề**: Bạn có cả Claude subscription và GLM Coding Plan. Hai tình huống xảy ra hàng ngày:
1. **Rate limit**: Claude hết lượt giữa chừng project, phải tự tay sửa file `~/.claude/settings.json` để chuyển
2. **Tối ưu công việc**: Planning phức tạp cần trí tuệ của Claude Sonnet 4.5, nhưng coding đơn giản thì GLM 4.6 vẫn làm tốt

Chuyển đổi thủ công rất mất thời gian và dễ sai.

**Giải pháp**:
```bash
ccs son       # Refactoring phức tạp? Dùng Claude Sonnet 4.5
ccs glm       # Fix bug đơn giản? Dùng GLM 4.6
# Hết rate limit? Chuyển ngay:
ccs glm       # Tiếp tục làm việc với GLM
```

Một lệnh. Không downtime. Không phải sửa file. Đúng model, đúng việc.

## Bắt Đầu Nhanh

**Cài đặt**:

**macOS / Linux**:
```bash
curl -fsSL ccs.kaitran.ca/install | bash
```

**Windows PowerShell**:
```powershell
irm ccs.kaitran.ca/install.ps1 | iex
```

**Cấu hình**:
```bash
# Sửa theo profile của bạn
cat > ~/.ccs/config.json << 'EOF'
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "son": "~/.ccs/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
EOF
```

**Sử dụng**:
```bash
ccs          # Dùng profile mặc định
ccs glm      # Dùng GLM profile
ccs son      # Dùng Sonnet profile
```

## Tại Sao Nên Dùng CCS?

### 🎯 Tối Ưu Theo Từng Tác Vụ

**Không có CCS**: Dùng Claude cho mọi thứ → Tốn chi phí, nhanh hết rate limit

**Có CCS**: Chuyển model theo độ phức tạp, tối đa hóa chất lượng mà vẫn quản lý được chi phí.

```bash
ccs son       # Planning kiến trúc tính năng mới
# Đã có plan? Code với GLM:
ccs glm       # Viết code đơn giản
```

### ⚡ Xử Lý Rate Limit

Nếu bạn có cả Claude subscription và GLM Coding Plan, bạn biết cái khổ:
- Claude hết rate limit giữa chừng
- Phải mở `~/.claude/settings.json`
- Copy-paste config từ file backup
- Lặp lại 10 lần mỗi ngày

**CCS giải quyết**:
- Một lệnh để chuyển: `ccs glm` hoặc `ccs son`
- Lưu cả hai config dạng profiles
- Chuyển trong <1 giây
- Không phải sửa file, không copy-paste, không sai sót

### 🔧 Tính Năng

- Zero config mặc định: installer tự tạo profiles
- Chuyển profile bằng một lệnh: `ccs glm`, `ccs son`
- Hỗ trợ profile tùy chỉnh không giới hạn
- Truyền toàn bộ args của Claude CLI
- Setup thông minh: tự nhận diện provider hiện tại
- Tự động tạo configs khi cài đặt
- Không proxy, không magic—chỉ bash + jq

## Cài Đặt

### Một Dòng Lệnh (Khuyến Nghị)

**macOS / Linux**:
```bash
# URL ngắn (qua CloudFlare)
curl -fsSL ccs.kaitran.ca/install | bash

# Hoặc trực tiếp từ GitHub
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/install.sh | bash
```

**Windows PowerShell**:
```powershell
# URL ngắn (qua CloudFlare)
irm ccs.kaitran.ca/install.ps1 | iex

# Hoặc trực tiếp từ GitHub
irm https://raw.githubusercontent.com/kaitranntt/ccs/main/install.ps1 | iex
```

**Lưu ý**:
- Installer Unix hỗ trợ cả chạy trực tiếp (`./install.sh`) và piped installation (`curl | bash`)
- Installer Windows yêu cầu PowerShell 5.1+ (có sẵn trên Windows 10+)

### Git Clone

**macOS / Linux**:
```bash
git clone https://github.com/kaitranntt/ccs.git
cd ccs
./install.sh
```

**Windows PowerShell**:
```powershell
git clone https://github.com/kaitranntt/ccs.git
cd ccs
.\install.ps1
```

**Lưu ý**: Hoạt động với git worktrees và submodules - installer phát hiện cả `.git` directory và `.git` file.

### Thủ Công

**macOS / Linux**:
```bash
# Tải script
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs -o ~/.local/bin/ccs
chmod +x ~/.local/bin/ccs

# Đảm bảo ~/.local/bin trong PATH
export PATH="$HOME/.local/bin:$PATH"
```

**Windows PowerShell**:
```powershell
# Tạo thư mục
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ccs"

# Tải script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs.ps1" -OutFile "$env:USERPROFILE\.ccs\ccs.ps1"

# Thêm vào PATH (khởi động lại terminal sau đó)
$Path = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$Path;$env:USERPROFILE\.ccs", "User")
```

### Nâng Cấp

**macOS / Linux**:
```bash
# Từ git clone
cd ccs && git pull && ./install.sh

# Từ curl install
curl -fsSL ccs.kaitran.ca/install | bash
```

**Windows PowerShell**:
```powershell
# Từ git clone
cd ccs
git pull
.\install.ps1

# Từ irm install
irm ccs.kaitran.ca/install.ps1 | iex
```

**Lưu ý**: Nâng cấp giữ nguyên API keys và settings hiện tại. Installer chỉ thêm tính năng mới mà không ghi đè cấu hình của bạn.

## Cấu Hình

Installer tự động tạo config và profile templates khi cài đặt:

**macOS / Linux**: `~/.ccs/config.json`
**Windows**: `%USERPROFILE%\.ccs\config.json`

Nếu cần tùy chỉnh:

```json
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "son": "~/.ccs/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

### Cấu Hình macOS / Linux

Dùng file paths trỏ đến settings files:

```json
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "sonnet": "~/.ccs/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

Mỗi profile trỏ đến một file settings JSON của Claude. Tạo file settings theo [tài liệu Claude CLI](https://docs.claude.com/en/docs/claude-code/installation).

### Cấu Hình Windows

**Quan trọng**: Claude CLI trên Windows dùng **biến môi trường** thay vì --settings flag.

Windows dùng cùng cấu trúc file như Linux, nhưng settings files chứa environment variables:

**Config format** (`~/.ccs/config.json`):
```json
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "son": "~/.ccs/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

**GLM profile** (`~/.ccs/glm.settings.json`):
```json
{
  "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
  "ANTHROPIC_AUTH_TOKEN": "GLM_API_KEY_CUA_BAN",
  "ANTHROPIC_MODEL": "glm-4.6",
  "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
  "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6"
}
```

**Claude profile** (`~/.ccs/sonnet.settings.json`):
```json
{
  "env": {}
}
```

**Cách hoạt động**:
- CCS đọc settings file của profile được chọn
- Tạm thời set biến môi trường từ settings file
- Chạy Claude CLI với các biến đó
- Khôi phục biến môi trường gốc sau khi thực thi

**Tương thích**: Settings files hỗ trợ cả format trực tiếp (Windows) và wrapper `{"env": {...}}` (tương thích Linux).

## Sử Dụng

### Cơ Bản

```bash
# Hoạt động trên macOS, Linux, và Windows
ccs           # Dùng profile mặc định (không args)
ccs glm       # Dùng GLM profile
ccs son       # Dùng Sonnet profile
```

**Lưu ý Windows**: Lệnh hoạt động giống nhau trên PowerShell, CMD, và Git Bash.

### Với Arguments

Tất cả args sau tên profile được truyền trực tiếp cho Claude CLI:

```bash
ccs glm --verbose
ccs son /plan "thêm tính năng"
ccs default --model claude-sonnet-4
```

### Ví Dụ

**Tự động hoàn thành**:
```bash
# Nếu shell của bạn hỗ trợ aliases
alias cs='ccs'
cs glm
```

## Use Cases

### 1. Tích Hợp Thanh Toán

```bash
# Bước 1: Kiến trúc & Planning (cần trí tuệ của Claude)
ccs son
/plan "Thiết kế tích hợp thanh toán với Stripe, xử lý webhooks, errors, retries"
# → Claude Sonnet 4.5 suy nghĩ sâu về edge cases, bảo mật, kiến trúc

# Bước 2: Implement (coding đơn giản)
ccs glm
/code "implement payment handler theo plan"
# → GLM 4.6 viết code hiệu quả, tiết kiệm usage của Claude

# Bước 3: Code Review (cần phân tích sâu)
ccs son
/review "kiểm tra payment handler về vấn đề bảo mật"
# → Claude Sonnet 4.5 phát hiện các lỗ hổng tinh vi

# Bước 4: Testing & Fixes (công việc lặp lại)
ccs glm
/fix "sửa các issues từ review"
# → GLM 4.6 xử lý fixes đơn giản
```

### 2. Hết Rate Limit Giữa Chừng

```bash
# Đang làm refactoring phức tạp với Claude
ccs son
/plan "refactor hệ thống authentication"

# Claude hết rate limit giữa task
# ❌ TRƯỚC: Phải chờ hoặc manually sửa settings

# ✅ BÂY GIỜ: Chuyển ngay
ccs glm
# Tiếp tục làm việc không gián đoạn

# Rate limit reset? Chuyển lại
ccs son
```

### Ví Dụ Cấu Hình

**Nhiều GLM accounts cho rate limits cao hơn**:
```json
{
  "profiles": {
    "glm1": "~/.ccs/glm-account1.settings.json",
    "glm2": "~/.ccs/glm-account2.settings.json",
    "son": "~/.ccs/sonnet.settings.json"
  }
}
```

**Profiles cho từng dự án**:
```json
{
  "profiles": {
    "work": "~/.ccs/work.settings.json",
    "personal": "~/.ccs/personal.settings.json",
    "experiments": "~/.ccs/experiments.settings.json"
  }
}
```

## Yêu Cầu

### macOS / Linux
- **Bash** 3.2+
- **jq** (để xử lý JSON)
- **Claude CLI** đã cài đặt

### Windows
- **PowerShell** 5.1+ (có sẵn trên Windows 10+)
- **Claude CLI** đã cài đặt

### Cài jq (chỉ macOS / Linux)

**macOS**:
```bash
brew install jq
```

**Ubuntu/Debian**:
```bash
sudo apt install jq
```

**Fedora**:
```bash
sudo dnf install jq
```

**Arch**:
```bash
sudo pacman -S jq
```

**Lưu ý**: Phiên bản Windows dùng JSON support có sẵn của PowerShell - không cần jq.

## Troubleshooting

### Vấn Đề Riêng Cho Windows

#### PowerShell Execution Policy

Nếu bạn thấy lỗi "cannot be loaded because running scripts is disabled":

```powershell
# Kiểm tra policy hiện tại
Get-ExecutionPolicy

# Cho phép user hiện tại chạy scripts (khuyến nghị)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Hoặc chạy với bypass (một lần)
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.ccs\ccs.ps1" glm
```

#### PATH chưa được cập nhật (Windows)

Nếu lệnh `ccs` không tìm thấy sau khi cài đặt:

1. Khởi động lại terminal
2. Hoặc thêm thủ công vào PATH:
   - Mở "Edit environment variables for your account"
   - Thêm `%USERPROFILE%\.ccs` vào User PATH
   - Khởi động lại terminal

#### Claude CLI không tìm thấy (Windows)

```powershell
# Kiểm tra Claude CLI
where.exe claude

# Nếu thiếu, cài đặt từ tài liệu Claude
```

### Vấn Đề Cài Đặt

#### Lỗi BASH_SOURCE unbound variable

Lỗi này xảy ra khi chạy installer trong một số shells hoặc môi trường.

**Đã sửa trong phiên bản mới nhất**: Installer bây giờ xử lý cả piped execution (`curl | bash`) và direct execution (`./install.sh`).

**Giải pháp**: Nâng cấp lên phiên bản mới nhất:
```bash
curl -fsSL ccs.kaitran.ca/install | bash
```

#### Git worktree không được phát hiện

Nếu cài từ git worktree hoặc submodule, phiên bản cũ có thể không phát hiện git repository.

**Đã sửa trong phiên bản mới nhất**: Installer bây giờ phát hiện cả `.git` directory (standard clone) và `.git` file (worktree/submodule).

**Giải pháp**: Nâng cấp lên phiên bản mới nhất hoặc dùng curl installation.

### Vấn Đề Cấu Hình

#### Profile không tìm thấy

```
Error: Profile 'foo' not found in ~/.ccs/config.json
```

**Fix**: Thêm profile vào config:
```json
{
  "profiles": {
    "foo": "~/.ccs/foo.settings.json"
  }
}
```

#### File settings thiếu

```
Error: Settings file not found: ~/.ccs/foo.settings.json
```

**Fix**: Tạo file settings hoặc sửa path trong config.

#### jq chưa cài

```
Error: jq is required but not installed
```

**Fix**: Cài jq (xem phần Yêu Cầu).

**Lưu ý**: Installer tạo templates cơ bản ngay cả không có jq, nhưng các tính năng nâng cao cần jq.

### Vấn Đề Môi Trường

#### PATH chưa được thiết lập

```
⚠️  Warning: ~/.local/bin is not in PATH
```

**Fix**: Thêm vào shell profile (~/.bashrc hoặc ~/.zshrc):
```bash
export PATH="$HOME/.local/bin:$PATH"
```
Sau đó `source ~/.bashrc` hoặc khởi động lại shell.

#### Profile mặc định thiếu

```
Error: Profile 'default' not found in ~/.ccs/config.json
```

**Fix**: Thêm profile default:
```json
{
  "profiles": {
    "default": "~/.claude/settings.json"
  }
}
```

### Vấn Đề Nâng Cấp

#### API keys bị mất sau khi nâng cấp

**Không phải vấn đề**: Installer giữ nguyên API keys hiện tại khi nâng cấp. Nếu bạn đang dùng GLM, API key của bạn được tự động giữ lại và profile được nâng cấp với các biến default model mới.

**Xác minh**: Kiểm tra `~/.ccs/glm.settings.json` - `ANTHROPIC_AUTH_TOKEN` của bạn vẫn còn đó.

## Gỡ Cài Đặt

### macOS / Linux

**Dùng lệnh đã cài**:
```bash
ccs-uninstall
```

**Một dòng lệnh**:
```bash
# URL ngắn
curl -fsSL ccs.kaitran.ca/uninstall | bash

# Hoặc trực tiếp từ GitHub
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/uninstall.sh | bash
```

**Thủ công**:
```bash
rm ~/.local/bin/ccs
rm ~/.local/bin/ccs-uninstall
rm -rf ~/.ccs  # Nếu muốn xóa tất cả files của CCS
```

### Windows PowerShell

**Dùng lệnh đã cài**:
```powershell
ccs-uninstall
```

**Một dòng lệnh**:
```powershell
# URL ngắn
irm ccs.kaitran.ca/uninstall.ps1 | iex

# Hoặc trực tiếp từ GitHub
irm https://raw.githubusercontent.com/kaitranntt/ccs/main/uninstall.ps1 | iex
```

**Thủ công**:
```powershell
# Xóa scripts
Remove-Item "$env:USERPROFILE\.ccs\ccs.ps1" -Force
Remove-Item "$env:USERPROFILE\.ccs\uninstall.ps1" -Force

# Xóa khỏi PATH
$Path = [Environment]::GetEnvironmentVariable("Path", "User")
$NewPath = ($Path -split ';' | Where-Object { $_ -ne "$env:USERPROFILE\.ccs" }) -join ';'
[Environment]::SetEnvironmentVariable("Path", $NewPath, "User")

# Tùy chọn: Xóa tất cả files CCS
Remove-Item "$env:USERPROFILE\.ccs" -Recurse -Force
```

## Bảo Mật

- ✅ Zero dependencies (chỉ bash + jq)
- ✅ Không internet calls ngoài cài đặt
- ✅ Không tracking, không telemetry
- ✅ Configs được lưu local
- ✅ Pass-through trực tiếp đến Claude CLI
- ✅ Open source, có thể audit

**Lưu ý**: CCS chỉ chuyển đổi file settings. Tất cả model execution được xử lý bởi Claude CLI chính thức.

## FAQ

**Q: CCS có gọi API không?**
A: Không. CCS chỉ chuyển đổi file config. Tất cả API calls đến từ Claude CLI chính thức.

**Q: Có thể dùng với các providers khác không?**
A: Có! Miễn là provider tương thích với Claude CLI settings format.

**Q: Cần internet để chuyển profiles không?**
A: Không. Profile switching hoàn toàn offline. Chỉ cần internet cho API calls của Claude CLI.

**Q: Settings cũ của tôi có bị ghi đè không?**
A: Không. Installer tạo files mới và giữ nguyên configs hiện tại.

**Q: CCS có hoạt động trên Windows không?**
A: Có! CCS bây giờ hỗ trợ Windows PowerShell 5.1+ ngoài macOS/Linux bash.

## Đóng Góp

Contributions được chào đón! Vui lòng:

1. Fork repo
2. Tạo feature branch
3. Commit changes của bạn
4. Push lên branch
5. Mở Pull Request

**Guidelines**:
- Duy trì tương thích bash 3.2+ (Unix) và PowerShell 5.1+ (Windows)
- Không dependencies ngoài jq (Unix) hoặc PowerShell có sẵn (Windows)
- Test trên macOS, Linux, và Windows
- Tuân theo code style hiện có

## License

MIT License - xem [LICENSE](LICENSE) để biết chi tiết.

## Tác Giả

Được tạo bởi [Kai Tran](https://github.com/kaitranntt)

## Links

- **GitHub**: https://github.com/kaitranntt/ccs
- **Issues**: https://github.com/kaitranntt/ccs/issues
- **Claude CLI Docs**: https://docs.claude.com/en/docs/claude-code/installation

---

Nếu CCS giúp ích cho bạn, cho một ⭐ trên GitHub! 🎉
