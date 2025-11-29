#!/bin/bash
# Auto-install CCS locally for testing changes
# Usage: ./scripts/dev-install.sh
#
# Options:
#   --skip-validate  Skip validation (faster, use when you're sure code is good)

set -e

SKIP_VALIDATE=false
for arg in "$@"; do
    case $arg in
        --skip-validate) SKIP_VALIDATE=true ;;
    esac
done

echo "[i] CCS Dev Install - Starting..."

# Get to the right directory
cd "$(dirname "$0")/.."

# Build TypeScript first
echo "[i] Building TypeScript..."
bun run build

# Pack the npm package
echo "[i] Creating package..."
if [ "$SKIP_VALIDATE" = true ]; then
    # Skip validation, just pack
    bun pm pack --ignore-scripts
else
    # Full pack with validation (runs prepublishOnly)
    bun pm pack
fi

# Find the tarball
TARBALL=$(ls -t kaitranntt-ccs-*.tgz 2>/dev/null | head -1)

if [ -z "$TARBALL" ]; then
    echo "[X] ERROR: No tarball found"
    exit 1
fi

echo "[i] Found tarball: $TARBALL"

# Install globally using npm (handles bin linking correctly)
echo "[i] Installing globally with npm..."
npm install -g "$TARBALL"

# Clean up
echo "[i] Cleaning up..."
rm "$TARBALL"

echo "[OK] Complete! CCS is now updated."
echo ""
echo "Test with: ccs --version"
