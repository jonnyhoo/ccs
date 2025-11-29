# Hướng Dẫn Khắc Phục Sự Cố CCS

## Cảnh báo lỗi thời của trình cài đặt gốc

**Vấn đề:** "Tại sao trình cài đặt curl/irm hiển thị cảnh báo lỗi thời?"

**Nguyên nhân:** Trình cài đặt shell gốc đã lỗi thời, ưu tiên cài đặt npm.

**Giải pháp:**
```bash
# Gỡ cài đặt phiên bản cũ (nếu cài qua curl/irm)
ccs-uninstall  # hoặc: curl -fsSL ccs.kaitran.ca/uninstall | bash

# Cài đặt qua npm (khuyến nghị)
npm install -g @kaitranntt/ccs
```

**Lưu ý:** Trình cài đặt cũ hiện tự động chạy npm install nếu Node.js khả dụng.

## Vấn Đề Riêng Của Windows

### PowerShell Execution Policy

Nếu bạn thấy "cannot be loaded because running scripts is disabled":

```powershell
# Kiểm tra policy hiện tại
Get-ExecutionPolicy

# Cho phép user hiện tại chạy scripts (khuyến nghị)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Hoặc chạy với bypass (một lần)
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.ccs\ccs.ps1" glm
```

### PATH chưa được cập nhật (Windows)

Nếu lệnh `ccs` không tìm thấy sau khi cài đặt:

1. Khởi động lại terminal của bạn
2. Hoặc thêm thủ công vào PATH:
   - Mở "Edit environment variables for your account"
   - Thêm `%USERPROFILE%\.ccs` vào User PATH
   - Khởi động lại terminal

### Claude CLI không tìm thấy (Windows)

```powershell
# Kiểm tra Claude CLI
where.exe claude

# Nếu thiếu, cài đặt từ tài liệu Claude
```

## Claude CLI Ở Vị Trí Không Chuẩn

Nếu Claude CLI được cài đặt trên ổ đĩa khác hoặc vị trí tùy chỉnh (phổ biến trên Windows với ổ D:):

### Triệu Chứng
```
╔═════════════════════════════════════════════╗
║  ERROR                                      ║
╚═════════════════════════════════════════════╝

Claude CLI not found

Searched:
  - CCS_CLAUDE_PATH: (not set)
  - System PATH: not found
  - Common locations: not found
```

### Giải Pháp: Đặt CCS_CLAUDE_PATH

**Bước 1: Tìm Vị Trí Claude CLI**

*Windows*:
```powershell
# Tìm kiếm tất cả ổ đĩa
Get-ChildItem -Path C:\,D:\,E:\ -Filter claude.exe -Recurse -ErrorAction SilentlyContinue | Select-Object FullName

# Các vị trí phổ biến cần kiểm tra thủ công
D:\Program Files\Claude\claude.exe
D:\Tools\Claude\claude.exe
D:\Users\<Username>\AppData\Local\Claude\claude.exe
```

*Unix/Linux/macOS*:
```bash
# Tìm kiếm hệ thống
sudo find / -name claude 2>/dev/null

# Hoặc kiểm tra các vị trí cụ thể
ls -la /usr/local/bin/claude
ls -la ~/.local/bin/claude
ls -la /opt/homebrew/bin/claude
```

**Bước 2: Đặt Biến Môi Trường**

*Windows (PowerShell) - Vĩnh viễn*:
```powershell
# Thay bằng đường dẫn thực tế của bạn
$ClaudePath = "D:\Program Files\Claude\claude.exe"

# Đặt cho phiên hiện tại
$env:CCS_CLAUDE_PATH = $ClaudePath

# Đặt vĩnh viễn cho user
[Environment]::SetEnvironmentVariable("CCS_CLAUDE_PATH", $ClaudePath, "User")

# Khởi động lại terminal để áp dụng
```

*Unix (bash) - Vĩnh viễn*:
```bash
# Thay bằng đường dẫn thực tế của bạn
CLAUDE_PATH="/opt/custom/location/claude"

# Thêm vào shell profile
echo "export CCS_CLAUDE_PATH=\"$CLAUDE_PATH\"" >> ~/.bashrc

# Reload profile
source ~/.bashrc
```

*Unix (zsh) - Vĩnh viễn*:
```bash
# Thay bằng đường dẫn thực tế của bạn
CLAUDE_PATH="/opt/custom/location/claude"

# Thêm vào shell profile
echo "export CCS_CLAUDE_PATH=\"$CLAUDE_PATH\"" >> ~/.zshrc

# Reload profile
source ~/.zshrc
```

**Bước 3: Xác Minh Cấu Hình**

```bash
# Kiểm tra biến môi trường đã được đặt
echo $CCS_CLAUDE_PATH        # Unix
$env:CCS_CLAUDE_PATH         # Windows

# Kiểm tra CCS có thể tìm thấy Claude
ccs --version

# Kiểm tra với profile thực tế
ccs glm --version
```

### Các Vấn Đề Phổ Biến

**Đường Dẫn Không Hợp Lệ**:
```
Error: File not found: D:\Program Files\Claude\claude.exe
```

**Sửa**: Kiểm tra kỹ đường dẫn, đảm bảo file tồn tại:
```powershell
Test-Path "D:\Program Files\Claude\claude.exe"  # Windows
ls -la "/path/to/claude"                         # Unix
```

**Thư Mục Thay Vì File**:
```
Error: Path is a directory: D:\Program Files\Claude
```

**Sửa**: Đường dẫn phải trỏ đến file `claude.exe`, không phải thư mục:
```powershell
# Sai
$env:CCS_CLAUDE_PATH = "D:\Program Files\Claude"

# Đúng
$env:CCS_CLAUDE_PATH = "D:\Program Files\Claude\claude.exe"
```

**Không Thể Thực Thi**:
```
Error: File is not executable: /path/to/claude
```

**Sửa** (chỉ Unix):
```bash
chmod +x /path/to/claude
```

### Cấu Hình Riêng Cho WSL

Khi sử dụng Claude trên Windows từ WSL:

```bash
# Định dạng đường dẫn mount: /mnt/d/ cho ổ D:
export CCS_CLAUDE_PATH="/mnt/d/Program Files/Claude/claude.exe"

# Thêm vào ~/.bashrc để lưu
echo 'export CCS_CLAUDE_PATH="/mnt/d/Program Files/Claude/claude.exe"' >> ~/.bashrc
source ~/.bashrc
```

**Lưu ý**: Khoảng trắng trong đường dẫn Windows hoạt động đúng từ WSL khi được quote đúng cách.

### Debug Phát Hiện

Để xem CCS đã kiểm tra gì:

```bash
# Tạm thời di chuyển claude ra khỏi PATH để kiểm tra
# Sau đó chạy ccs - thông báo lỗi sẽ hiển thị những gì đã được kiểm tra

ccs --version
# Sẽ hiển thị:
#   - CCS_CLAUDE_PATH: (status)
#   - System PATH: not found
#   - Common locations: not found
```

### Phương Án Thay Thế: Thêm Vào PATH

Nếu bạn không muốn dùng CCS_CLAUDE_PATH, thêm thư mục Claude vào PATH:

*Windows (PowerShell)*:
```powershell
# Thêm D:\Program Files\Claude vào PATH
$ClaudeDir = "D:\Program Files\Claude"
$env:Path += ";$ClaudeDir"
[Environment]::SetEnvironmentVariable("Path", $env:Path, "User")

# Khởi động lại terminal
```

*Unix (bash)*:
```bash
# Thêm /opt/claude/bin vào PATH
echo 'export PATH="/opt/claude/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Lưu ý**: CCS_CLAUDE_PATH có ưu tiên cao hơn PATH, cho phép ghi đè cho từng dự án.

## Vấn Đề Cài Đặt

### Lỗi BASH_SOURCE unbound variable

Lỗi này xảy ra khi chạy installer trong một số shells hoặc môi trường.

**Đã sửa trong phiên bản mới nhất**: Installer bây giờ xử lý cả thực thi qua pipe (`curl | bash`) và thực thi trực tiếp (`./install.sh`).

**Giải pháp**: Nâng cấp lên phiên bản mới nhất:
```bash
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/installers/install.sh | bash
```

### Git worktree không được phát hiện

Nếu cài từ git worktree hoặc submodule, các phiên bản cũ có thể không phát hiện repository git.

**Đã sửa trong phiên bản mới nhất**: Installer bây giờ phát hiện cả thư mục `.git` (clone chuẩn) và file `.git` (worktree/submodule).

**Giải pháp**: Nâng cấp lên phiên bản mới nhất hoặc dùng phương pháp cài đặt curl.

## Vấn Đề Cấu Hình

### Không tìm thấy profile

```
Error: Profile 'foo' not found in ~/.ccs/config.json
```

**Fix**: Thêm profile vào `~/.ccs/config.json`:
```json
{
  "profiles": {
    "foo": "~/.ccs/foo.settings.json"
  }
}
```

### Thiếu file settings

```
Error: Settings file not found: ~/.ccs/foo.settings.json
```

**Fix**: Tạo file settings hoặc sửa đường dẫn trong config.

### jq chưa được cài đặt

```
Error: jq is required but not installed
```

**Fix**: Cài đặt jq (xem hướng dẫn cài đặt).

**Lưu ý**: Installer tạo các mẫu cơ bản ngay cả khi không có jq, nhưng các tính năng nâng cao cần jq.

## Vấn Đề Cấu Hình PATH

### Cấu Hình PATH Tự Động

v2.2.0+ tự động cấu hình shell PATH. Nếu bạn thấy hướng dẫn reload sau khi cài, hãy làm theo:

**Cho bash**:
```bash
source ~/.bashrc
```

**Cho zsh**:
```bash
source ~/.zshrc
```

**Cho fish**:
```fish
source ~/.config/fish/config.fish
```

**Hoặc mở cửa sổ terminal mới** (PATH tự động load).

### PATH Chưa Được Cấu Hình

Nếu lệnh `ccs` không tìm thấy sau khi cài và reload:

**Xác minh PATH entry tồn tại**:
```bash
# Cho bash/zsh
grep "\.local/bin" ~/.bashrc ~/.zshrc

# Cho fish
grep "\.local/bin" ~/.config/fish/config.fish
```

**Sửa thủ công** (nếu auto-config thất bại):

Bash:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Zsh:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Fish:
```fish
echo 'set -gx PATH $HOME/.local/bin $PATH' >> ~/.config/fish/config.fish
source ~/.config/fish/config.fish
```

### Shell Profile Sai

Nếu auto-config thêm vào file sai:

**Tìm profile đang active**:
```bash
echo $SHELL  # Hiển thị shell hiện tại
```

**Tình huống phổ biến**:
- macOS bash dùng `~/.bash_profile` (không phải `~/.bashrc`)
- Shell tùy chỉnh cần config thủ công
- Tmux/screen có thể dùng shell khác

**Giải pháp**: Thêm PATH thủ công vào file profile đúng.

### Shell Không Được Phát Hiện

Nếu installer không thể phát hiện shell:

**Triệu chứng**:
- Không có cảnh báo PATH hiển thị
- Lệnh `ccs` không tìm thấy sau khi cài

**Giải pháp**: Thiết lập PATH thủ công (xem ở trên).

### Thiếu profile mặc định

```
Error: Profile 'default' not found in ~/.ccs/config.json
```

**Fix**: Thêm profile "default" hoặc luôn chỉ định tên profile:
```json
{
  "profiles": {
    "default": "~/.claude/settings.json"
  }
}
```

## Vấn Đề Phổ Biến

### Claude CLI không tìm thấy

```
Error: claude command not found
```

**Giải pháp**: Cài đặt Claude CLI từ [tài liệu chính thức](https://docs.claude.com/en/docs/claude-code/installation).

### Permission denied (Unix)

```
Error: Permission denied: ~/.local/bin/ccs
```

**Giải pháp**: Cho phép script thực thi:
```bash
chmod +x ~/.local/bin/ccs
```

### Không tìm thấy file config

```
Error: Config file not found: ~/.ccs/config.json
```

**Giải pháp**: Chạy lại installer hoặc tạo config thủ công:
```bash
mkdir -p ~/.ccs
echo '{"profiles":{"default":"~/.claude/settings.json"}}' > ~/.ccs/config.json
```

## Nhận Trợ Giúp

Nếu bạn gặp các vấn đề không được đề cập ở đây:

1. Kiểm tra [GitHub Issues](https://github.com/kaitranntt/ccs/issues)
2. Tạo issue mới với:
   - Hệ điều hành của bạn
   - Phiên bản CCS (`ccs --version`)
   - Thông báo lỗi chính xác
   - Các bước để tái tạo vấn đề

## Chế Độ Debug

Bật verbose output để khắc phục sự cố:

```bash
ccs --verbose glm
```

Điều này sẽ hiển thị:
- File config nào đang được đọc
- Profile nào đang được chọn
- File settings nào đang được sử dụng
- Lệnh chính xác đang được thực thi

## Tắt Output Có Màu

Nếu output có màu gây vấn đề trong terminal hoặc logs của bạn:

```bash
export NO_COLOR=1
ccs glm
```

**Trường Hợp Sử Dụng**:
- Môi trường CI/CD
- Tạo log file
- Terminal không hỗ trợ màu
- Tùy chọn trợ năng