#!/bin/bash
# Pre-Release Checklist for CCS
set -euo pipefail

echo "=== Pre-Release Checklist ==="
echo ""

# 1. Version check
echo "[i] Current version: $(node -p "require('./package.json').version")"

# 2. Clean build
echo "[i] Clean build..."
rm -rf dist
bun run build:all

# 3. Bundle size
echo "[i] Bundle size check..."
node scripts/verify-bundle.js

# 4. Lint & typecheck
echo "[i] Lint & typecheck..."
bun run validate

# 5. Tests
echo "[i] Running tests..."
bun test

# 6. Help consistency check
echo "[i] Checking help text includes config command..."
if ! grep -q "ccs config" src/commands/help-command.ts; then
    echo "[!] Missing config in help-command.ts"
fi

# 7. Package contents
echo "[i] Package contents..."
npm pack --dry-run 2>&1 | head -20

echo ""
echo "=== Ready for release ==="
