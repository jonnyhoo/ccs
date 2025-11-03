#!/usr/bin/env bash
set -euo pipefail

# --- Color/Format Functions ---
setup_colors() {
  if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
    GREEN='\033[0;32m'
    CYAN='\033[0;36m'
    RESET='\033[0m'
  else
    GREEN='' CYAN='' RESET=''
  fi
}

msg_success() {
  echo -e "${GREEN}[OK] $1${RESET}"
}

msg_info() {
  echo -e "${CYAN}[i] $1${RESET}"
}

# --- Selective Cleanup Function ---
selective_cleanup() {
  local ccs_dir="$1"
  local removed=()
  local kept=()

  # Remove executables and version metadata
  for file in "ccs" "uninstall.sh" "VERSION"; do
    if [[ -f "$ccs_dir/$file" ]]; then
      rm "$ccs_dir/$file"
      removed+=("$file")
    fi
  done

  # Track kept files
  [[ -f "$ccs_dir/config.json" ]] && kept+=("config.json")
  [[ -f "$ccs_dir/config.json.backup" ]] && kept+=("config.json.backup")
  for settings in "$ccs_dir"/*.settings.json; do
    [[ -f "$settings" ]] && kept+=("$(basename "$settings")")
  done
  [[ -d "$ccs_dir/.claude" ]] && kept+=(".claude/")

  # Report results
  if [[ ${#removed[@]} -gt 0 ]]; then
    msg_info "Cleaned up: ${removed[*]}"
  fi

  if [[ ${#kept[@]} -gt 0 ]]; then
    msg_info "Kept config files: ${kept[*]}"
  fi
}

setup_colors

echo "Uninstalling ccs..."
echo ""

# Remove from ~/.local/bin (standard location)
if [[ -L "$HOME/.local/bin/ccs" ]]; then
  rm "$HOME/.local/bin/ccs"
  msg_success "Removed: $HOME/.local/bin/ccs"
elif [[ -f "$HOME/.local/bin/ccs" ]]; then
  rm "$HOME/.local/bin/ccs"
  msg_success "Removed: $HOME/.local/bin/ccs"
fi

if [[ -L "$HOME/.local/bin/ccs-uninstall" ]]; then
  rm "$HOME/.local/bin/ccs-uninstall"
  msg_success "Removed: $HOME/.local/bin/ccs-uninstall"
fi

# Ask about ~/.ccs directory
if [[ -d "$HOME/.ccs" ]]; then
  read -p "Remove CCS directory ~/.ccs? This includes config and profiles. (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$HOME/.ccs"
    msg_success "Removed: $HOME/.ccs"
  else
    echo ""
    selective_cleanup "$HOME/.ccs"
  fi
else
  msg_info "No CCS directory found at $HOME/.ccs"
fi

echo ""
msg_success "Uninstall complete!"
