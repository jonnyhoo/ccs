#!/usr/bin/env bash
# CCS --uninstall Functionality Testing (Linux/macOS)
# Comprehensive tests for the --uninstall command

set +e  # Don't exit on errors, we're testing
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_TESTS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CCS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CCS_PATH="$CCS_ROOT/ccs"

# Backup/restore paths
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="/tmp/ccs-test-backup-$(date +%s)"
TEST_HOME="/tmp/ccs-test-home"
TEST_CLAUDE_DIR="$TEST_HOME/.claude"

test_case() {
    local name="$1"
    local expected="$2"
    shift 2

    ((TOTAL_TESTS++))
    echo ""
    echo -e "${CYAN}[$TOTAL_TESTS] $name${NC}"
    echo -e "${GRAY}    Expected: $expected${NC}"

    if "$@"; then
        echo -e "${GREEN}    Result: PASS${NC}"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}    Result: FAIL${NC}"
        ((FAIL_COUNT++))
        return 1
    fi
}

cleanup_and_restore() {
    echo ""
    echo -e "${YELLOW}Cleaning up and restoring...${NC}"

    # Remove test directory
    if [[ -d "$TEST_HOME" ]]; then
        rm -rf "$TEST_HOME"
    fi

    # Restore backup if it exists
    if [[ -d "$BACKUP_DIR" ]]; then
        if [[ -d "$CLAUDE_DIR" ]]; then
            rm -rf "$CLAUDE_DIR"
        fi
        mv "$BACKUP_DIR" "$CLAUDE_DIR"
    fi

    echo -e "${GREEN}Cleanup complete.${NC}"
}

# ============================================================================
# SETUP
# ============================================================================

echo ""
echo "========================================"
echo "CCS --uninstall Functionality Tests"
echo "========================================"
echo ""

# Backup existing .claude directory if it exists
if [[ -d "$CLAUDE_DIR" ]]; then
    echo -e "${YELLOW}Backing up existing .claude directory...${NC}"
    cp -r "$CLAUDE_DIR" "$BACKUP_DIR"
fi

# Clean any existing test directory
if [[ -d "$TEST_HOME" ]]; then
    rm -rf "$TEST_HOME"
fi

mkdir -p "$TEST_HOME"

# ============================================================================
# TEST SECTION 1: UNINSTALL WHEN NOTHING IS INSTALLED
# ============================================================================

echo ""
echo "========================================"
echo "SECTION 1: UNINSTALL WHEN NOTHING IS INSTALLED"
echo "========================================"

test_case "Empty uninstall: Command executes without error" "Exit code 0" bash -c "
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /tmp/ccs-uninstall-empty.txt 2>&1
"

test_case "Empty uninstall: Output contains 'Nothing to uninstall'" "Appropriate message" bash -c "
    output=\$(HOME='$TEST_HOME' '$CCS_PATH' --uninstall 2>&1)
    [[ \$output =~ 'Nothing to uninstall' ]]
"

test_case "Empty uninstall: Reports 0 items removed" "Zero removed count" bash -c "
    output=\$(HOME='$TEST_HOME' '$CCS_PATH' --uninstall 2>&1)
    [[ \$output =~ 'Removed: 0 items' ]]
"

# ============================================================================
# SETUP FOR FULL INSTALL/UNINSTALL CYCLE
# ============================================================================

# Install first so we can test uninstall
# NOTE: --install is currently a no-op (under development), but we call it
# to test the install/uninstall cycle works without errors
echo ""
echo -e "${YELLOW}Setting up for install/uninstall cycle test...${NC}"
bash -c "HOME='$TEST_HOME' '$CCS_PATH' --install > /dev/null 2>&1"

# ============================================================================
# TEST SECTION 2: UNINSTALL AFTER INSTALL
# ============================================================================

echo ""
echo "========================================"
echo "SECTION 2: UNINSTALL AFTER INSTALL"
echo "========================================"

test_case "Uninstall: Command executes without error" "Exit code 0" bash -c "
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /tmp/ccs-uninstall-after-install.txt 2>&1
"

test_case "Uninstall: Removes ccs.md command file" "Command file removed" bash -c "
    [[ ! -f '$TEST_CLAUDE_DIR/commands/ccs.md' ]]
"

test_case "Uninstall: Removes ccs-delegation skill directory" "Skill directory removed" bash -c "
    [[ ! -d '$TEST_CLAUDE_DIR/skills/ccs-delegation' ]]
"

test_case "Uninstall: Preserves other commands" "Other commands unaffected" bash -c "
    # Create a dummy command file first
    mkdir -p '$TEST_CLAUDE_DIR/commands'
    echo 'test' > '$TEST_CLAUDE_DIR/commands/test.md'
    # Install CCS, then uninstall
    HOME='$TEST_HOME' '$CCS_PATH' --install > /dev/null 2>&1
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    # Check that test.md still exists
    [[ -f '$TEST_CLAUDE_DIR/commands/test.md' ]]
"

test_case "Uninstall: Preserves other skills" "Other skills unaffected" bash -c "
    # Create a dummy skill directory first
    mkdir -p '$TEST_CLAUDE_DIR/skills/test-skill'
    echo 'test' > '$TEST_CLAUDE_DIR/skills/test-skill/SKILL.md'
    # Install CCS, then uninstall
    HOME='$TEST_HOME' '$CCS_PATH' --install > /dev/null 2>&1
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    # Check that test-skill still exists
    [[ -d '$TEST_CLAUDE_DIR/skills/test-skill' ]]
"

# ============================================================================
# TEST SECTION 3: IDEMPOTENCY
# ============================================================================

echo ""
echo "========================================"
echo "SECTION 3: IDEMPOTENCY"
echo "========================================"

test_case "Idempotent: Second uninstall succeeds" "Second --uninstall doesn't error" bash -c "
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    exit_code=\$?
    [[ \$exit_code -eq 0 ]]
"

test_case "Idempotent: Reports nothing to remove on second run" "Reports nothing found" bash -c "
    output=\$(HOME='$TEST_HOME' '$CCS_PATH' --uninstall 2>&1)
    [[ \$output =~ 'not found' ]] || [[ \$output =~ 'Nothing to uninstall' ]]
"

# ============================================================================
# TEST SECTION 4: OUTPUT FORMATTING
# ============================================================================

echo ""
echo "========================================"
echo "SECTION 4: OUTPUT FORMATTING"
echo "========================================"

# Set up fresh install for output testing
bash -c "HOME='$TEST_HOME' '$CCS_PATH' --install > /dev/null 2>&1"

test_case "Output: Contains box-drawing header" "Output has ┌─" bash -c "
    output=\$(HOME='$TEST_HOME' '$CCS_PATH' --uninstall 2>&1)
    [[ \$output =~ ┌─ ]]
"

test_case "Output: Contains box-drawing footer" "Output has └─" bash -c "
    output=\$(HOME='$TEST_HOME' '$CCS_PATH' --uninstall 2>&1)
    [[ \$output =~ └─ ]]
"

test_case "Output: Shows removal success message" "Contains '[OK] Uninstall complete!'" bash -c "
    output=\$(HOME='$TEST_HOME' '$CCS_PATH' --uninstall 2>&1)
    echo \"\$output\" | grep -q '\[OK\] Uninstall complete!'
"

test_case "Output: Shows reinstallation instruction" "Contains reinstallation hint" bash -c "
    output=\$(HOME='$TEST_HOME' '$CCS_PATH' --uninstall 2>&1)
    [[ \$output =~ 'To reinstall: ccs --install' ]]
"

# ============================================================================
# TEST SECTION 5: INTEGRATION WITH CCS
# ============================================================================

echo ""
echo "========================================"
echo "SECTION 5: INTEGRATION WITH CCS"
echo "========================================"

test_case "Integration: --uninstall executes without profile error" "No profile error on --uninstall" bash -c "
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    exit_code=\$?
    [[ \$exit_code -eq 0 ]]
"

test_case "Integration: --version still works after uninstall" "Version command exits successfully" bash -c "
    HOME='$TEST_HOME' '$CCS_PATH' --version > /dev/null 2>&1
    exit_code=\$?
    [[ \$exit_code -eq 0 ]]
"

test_case "Integration: --help still works after uninstall" "Help command exits successfully" bash -c "
    HOME='$TEST_HOME' '$CCS_PATH' --help > /dev/null 2>&1
    exit_code=\$?
    [[ \$exit_code -eq 0 ]]
"

# ============================================================================
# TEST SECTION 6: EDGE CASES
# ============================================================================

echo ""
echo "========================================"
echo "SECTION 6: EDGE CASES"
echo "========================================"

test_case "Edge case: Partial install (commands only)" "Handles partial installation" bash -c "
    # Create only command file
    mkdir -p '$TEST_CLAUDE_DIR/commands'
    echo 'test' > '$TEST_CLAUDE_DIR/commands/ccs.md'
    # Uninstall should handle this gracefully
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    exit_code=\$?
    [[ \$exit_code -eq 0 ]]
"

test_case "Edge case: Partial install (skills only)" "Handles partial installation" bash -c "
    # Create only skill directory
    mkdir -p '$TEST_CLAUDE_DIR/skills/ccs-delegation'
    echo 'test' > '$TEST_CLAUDE_DIR/skills/ccs-delegation/SKILL.md'
    # Uninstall should handle this gracefully
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    exit_code=\$?
    [[ \$exit_code -eq 0 ]]
"

test_case "Edge case: Missing parent directories" "Handles missing .claude directory" bash -c "
    # Ensure .claude directory doesn't exist
    rm -rf '$TEST_CLAUDE_DIR'
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    exit_code=\$?
    [[ \$exit_code -eq 0 ]]
"

# ============================================================================
# TEST SECTION 7: PER-PROFILE HOOK BEHAVIOR (Global settings untouched)
# ============================================================================

echo ""
echo "========================================"
echo "SECTION 7: PER-PROFILE HOOK BEHAVIOR"
echo "========================================"

test_case "Per-profile: Uninstall does NOT touch global settings.json" "Global settings unchanged" bash -c "
    # Setup: Create settings.json with user hook
    mkdir -p '$TEST_CLAUDE_DIR'
    cat > '$TEST_CLAUDE_DIR/settings.json' << 'EOFINNER'
{
  \"hooks\": {
    \"PreToolUse\": [
      { \"matcher\": \"WebSearch\", \"hooks\": [{ \"command\": \"my-custom-hook.sh\" }] }
    ]
  }
}
EOFINNER
    # Uninstall
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    # Verify global settings unchanged
    grep -q 'my-custom-hook' '$TEST_CLAUDE_DIR/settings.json'
"

test_case "Per-profile: Uninstall preserves user hooks in global settings" "User hooks in global preserved" bash -c "
    # Setup: Create settings.json with CCS hook (old format - shouldn't be touched)
    mkdir -p '$TEST_CLAUDE_DIR'
    cat > '$TEST_CLAUDE_DIR/settings.json' << 'EOFINNER'
{
  \"hooks\": {
    \"PreToolUse\": [
      { \"matcher\": \"WebSearch\", \"hooks\": [{ \"command\": \"node ~/.ccs/hooks/websearch-transformer.cjs\" }] },
      { \"matcher\": \"WebSearch\", \"hooks\": [{ \"command\": \"my-custom-hook.sh\" }] }
    ]
  }
}
EOFINNER
    # Uninstall - should NOT modify global settings
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    # Both hooks should still be in global settings (not touched)
    grep -q 'websearch-transformer' '$TEST_CLAUDE_DIR/settings.json' &&
    grep -q 'my-custom-hook' '$TEST_CLAUDE_DIR/settings.json'
"

test_case "Per-profile: Migration marker cleanup on uninstall" "Marker file removed" bash -c "
    # Setup: Create ~/.ccs/.hook-migrated marker
    mkdir -p '$TEST_HOME/.ccs'
    echo '2026-01-25T00:00:00.000Z' > '$TEST_HOME/.ccs/.hook-migrated'
    # Uninstall
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    # Verify marker removed
    [[ ! -f '$TEST_HOME/.ccs/.hook-migrated' ]]
"

test_case "Per-profile: Handles missing settings.json" "No error when settings.json missing" bash -c "
    # Ensure settings.json doesn't exist
    rm -f '$TEST_CLAUDE_DIR/settings.json'
    HOME='$TEST_HOME' '$CCS_PATH' --uninstall > /dev/null 2>&1
    exit_code=\$?
    [[ \$exit_code -eq 0 ]]
"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "========================================"
if [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "${GREEN}ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}--uninstall functionality is production ready!${NC}"
else
    echo -e "${RED}SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}Review failed tests above for details${NC}"
fi

echo ""
echo -e "${CYAN}Test Summary:${NC}"
echo -e "  Total tests: $TOTAL_TESTS"
echo -e "  ${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "  ${RED}Failed: $FAIL_COUNT${NC}"
echo ""

# Cleanup
cleanup_and_restore

exit $FAIL_COUNT