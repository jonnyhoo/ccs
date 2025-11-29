# Hướng Dẫn Cài Đặt CCS

> [!WARNING]
> **Trình cài đặt shell gốc (curl/irm) đã lỗi thời.**
> Sử dụng cài đặt npm cho tất cả các nền tảng. Trình cài đặt cũ sẽ bị xóa trong v5.0.

## Cài Đặt npm Package (Được khuyến nghị)

### Cài Đặt Đa Nền Tảng

**macOS / Linux / Windows**
```bash
npm install -g @kaitranntt/ccs
```

**Tương thích với tất cả các trình quản lý package:**
- `npm install -g @kaitranntt/ccs`
- `yarn global add @kaitranntt/ccs`
- `pnpm add -g @kaitranntt/ccs`
- `bun add -g @kaitranntt/ccs`

**Lợi ích của việc cài đặt npm:**
- ✅ Tương thích đa nền tảng
- ✅ Cấu hình PATH tự động
- ✅ Tự động tạo file cấu hình qua script postinstall
- ✅ Cập nhật dễ dàng: `npm update -g @kaitranntt/ccs`
- ✅ Gỡ cài đặt sạch: `npm uninstall -g @kaitranntt/ccs`
- ✅ Hỗ trợ version pinning
- ✅ Quản lý dependencies

**Những Gì Xảy Ra Trong Quá Trình Cài Đặt:**
1. npm tải xuống và cài đặt package
2. Script postinstall tự động tạo `~/.ccs/config.json` và `~/.ccs/glm.settings.json`
3. npm tạo lệnh `ccs` trong PATH của bạn

**Lưu ý**: Nếu bạn dùng `npm install --ignore-scripts`, file cấu hình sẽ không được tạo. Chạy lại mà không có flag đó:
```bash
npm install -g @kaitranntt/ccs --force
```

## [!] LỖI THỜI: Cài Đặt Một Dòng Lệnh (Cũ)

> [!WARNING]
> **Các trình cài đặt này đã lỗi thời và sẽ bị xóa trong v5.0.**
> Hiện tại chúng tự động chuyển hướng đến cài đặt npm. Vui lòng sử dụng npm trực tiếp.

### macOS / Linux

```bash
# URL ngắn (qua CloudFlare)
curl -fsSL ccs.kaitran.ca/install | bash

# Hoặc trực tiếp từ GitHub
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/installers/install.sh | bash
```

**Lưu ý**: Script hiển thị cảnh báo lỗi thời và tự động chạy cài đặt npm nếu Node.js khả dụng.

### Windows PowerShell

```powershell
# URL ngắn (qua CloudFlare)
irm ccs.kaitran.ca/install.ps1 | iex

# Hoặc trực tiếp từ GitHub
irm https://raw.githubusercontent.com/kaitranntt/ccs/main/installers/install.ps1 | iex
```

**Lưu ý**: Script hiển thị cảnh báo lỗi thời và tự động chạy cài đặt npm nếu Node.js khả dụng.

## Cài Đặt qua Git Clone

### macOS / Linux

```bash
git clone https://github.com/kaitranntt/ccs.git
cd ccs
./installers/install.sh
```

### Windows PowerShell

```powershell
git clone https://github.com/kaitranntt/ccs.git
cd ccs
.\installers\install.ps1
```

**Lưu ý**: Hoạt động với git worktrees và submodules - installer phát hiện cả thư mục `.git` và file `.git`.

## Cài Đặt Thủ Công

### macOS / Linux

```bash
# Tạo thư mục
mkdir -p ~/.local/bin

# Tải script
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs -o ~/.local/bin/ccs
chmod +x ~/.local/bin/ccs

# Thêm vào PATH (chọn shell của bạn)
# Cho bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Cho zsh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Cho fish
echo 'set -gx PATH $HOME/.local/bin $PATH' >> ~/.config/fish/config.fish
```

### Windows PowerShell

```powershell
# Tạo thư mục
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ccs"

# Tải script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs.ps1" -OutFile "$env:USERPROFILE\.ccs\ccs.ps1"

# Thêm vào PATH (khởi động lại terminal sau)
$Path = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$Path;$env:USERPROFILE\.ccs", "User")
```

## Những Gì Được Cài Đặt

**Vị Trí Tệp Thực Thi**:
- macOS / Linux: `~/.local/bin/ccs` (symlink đến `~/.ccs/ccs`)
- Windows: `%USERPROFILE%\.ccs\ccs.ps1`

**Thư Mục Cấu Hình** (`~/.ccs/`):
```bash
~/.ccs/
├── ccs                     # Tệp thực thi chính (symlink target)
├── config.json             # Cấu hình profile
├── config.json.backup      # Bản backup duy nhất (ghi đè mỗi lần cài)
├── glm.settings.json       # Profile GLM
├── VERSION                 # File version
├── uninstall.sh            # Trình gỡ cài đặt
└── .claude/                # Tích hợp Claude Code
    ├── commands/ccs.md     # meta-command /ccs
    └── skills/             # Kỹ năng delegation
```

## Nâng Cấp CCS

### macOS / Linux

```bash
# Từ git clone
cd ccs && git pull && ./install.sh

# Từ cài đặt curl
curl -fsSL ccs.kaitran.ca/install | bash
```

### Windows PowerShell

```powershell
# Từ git clone
cd ccs
git pull
.\install.ps1

# Từ cài đặt irm
irm ccs.kaitran.ca/install.ps1 | iex
```

## Cấu Hình PATH Tự Động

Installer tự động cấu hình PATH của shell:

**Shell Được Hỗ Trợ**:
- bash (`.bashrc` hoặc `.bash_profile`)
- zsh (`.zshrc`)
- fish (`.config/fish/config.fish`)

**Cách Hoạt Động**:
1. Phát hiện shell hiện tại từ biến môi trường `$SHELL`
2. Kiểm tra nếu `~/.local/bin` đã có trong PATH
3. Nếu chưa, thêm export phù hợp vào shell profile
4. Hiển thị hướng dẫn reload

**Idempotent**:
- An toàn khi chạy nhiều lần
- Kiểm tra entry PATH của CCS trước khi thêm
- Không tạo entry trùng lặp

**Thiết Lập PATH Thủ Công** (nếu auto-config thất bại):

Bash/Zsh:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc  # hoặc ~/.zshrc
source ~/.bashrc  # hoặc source ~/.zshrc
```

Fish:
```fish
echo 'set -gx PATH $HOME/.local/bin $PATH' >> ~/.config/fish/config.fish
```

## Yêu Cầu

### macOS / Linux
- `bash` 3.2+
- `jq` (trình xử lý JSON, tùy chọn cho tính năng nâng cao)
- [Claude CLI](https://docs.claude.com/en/docs/claude-code/installation)

### Windows
- PowerShell 5.1+ (đã cài sẵn trên Windows 10+)
- [Claude CLI](https://docs.claude.com/en/docs/claude-code/installation)

### Cài đặt jq (macOS / Linux, tùy chọn)

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq

# Fedora
sudo dnf install jq

# Arch
sudo pacman -S jq
```

**Lưu ý**:
- jq nâng cao quá trình tạo profile GLM nhưng không bắt buộc
- Windows dùng JSON support có sẵn của PowerShell - không cần jq
- Installer tạo template cơ bản mà không cần jq