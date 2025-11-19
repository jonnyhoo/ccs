---
name: ccs-delegation
description: AUTO-ACTIVATE for delegation-eligible tasks. Triggers on patterns like "fix typos", "add tests", "refactor to use", "add JSDoc", "analyze architecture". Also activates when user says "use ccs glm/kimi". Handles task validation, prompt enhancement, and execution via CCS CLI headless mode.
version: 2.6.0
---

# CCS Delegation

Delegate deterministic tasks to cost-optimized models via CCS CLI.

## Core Concept

Execute tasks via alternative models using `ccs {profile} -p "task"` equivalent to `claude --settings ~/.ccs/{profile}.settings -p "task"`

**Profiles:** GLM (cost-optimized), Kimi (long-context)

## User Invocation Patterns

Users trigger delegation naturally:
- "use ccs glm [task]" - Delegate to GLM (cost-optimized)
- "use ccs kimi [task]" - Delegate to Kimi (long-context)
- "use ccs glm:continue [task]" - Continue GLM session
- "use ccs kimi:continue [task]" - Continue Kimi session

**Examples:**
- "use ccs glm to fix typos in README.md"
- "use ccs kimi to analyze the entire architecture"
- "use ccs glm:continue to add unit tests"

## Agent Response Protocol

When user says "use ccs {profile} [task]":

1. **Validate eligibility** against Decision Framework
   - Check: Simple, mechanical, <5 files
   - Check: No design decisions required
   - Check: Clear acceptance criteria exists

2. **Enhance prompt** with context:
   - Add file paths if mentioned
   - Include working directory
   - Specify success criteria
   - Add relevant constraints

3. **Execute via Bash tool**:
   ```bash
   ccs {profile} -p "enhanced prompt"
   ```

4. **Report results** to user:
   - Cost (USD)
   - Duration (seconds)
   - Session ID (for continuation)
   - Exit code/status

**If ineligible:** Explain why and handle in main session.

## Decision Framework

**Delegate when:**
- Simple refactoring, tests, typos, documentation
- Deterministic, well-defined scope
- No discussion/decisions needed

**Keep in main when:**
- Architecture/design decisions
- Security-critical code
- Complex debugging requiring investigation
- Performance optimization
- Breaking changes/migrations

## Profile Selection

- **GLM**: Simple tasks (<5 files, clear scope, cost-optimized)
- **Kimi**: Long-context (multi-file analysis, architecture docs)

## Example Delegation Tasks

**Good candidates:**
- "add unit tests for UserService using Jest"
- "fix typos in README.md"
- "refactor parseConfig to use destructuring"
- "add JSDoc comments to auth.js"

**Bad candidates (keep in main):**
- "implement OAuth" (too complex, needs design)
- "improve performance" (requires profiling)
- "fix the bug" (needs investigation)

## Execution

Slash commands: `/ccs:glm "task"` or `/ccs:glm:continue "follow-up"`

Agent via Bash: `ccs glm -p "task"` or `ccs glm:continue -p "follow-up"`

## References

Template: `CLAUDE.md.template` - Copy to user's CLAUDE.md for auto-delegation config
Troubleshooting: `references/troubleshooting.md`
