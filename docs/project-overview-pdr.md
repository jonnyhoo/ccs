# CCS Project Overview and Product Development Requirements (PDR)

## Executive Summary

CCS (Claude Code Switch) is a TypeScript-based CLI tool that enables instant profile switching between Claude Sonnet 4.5, GLM 4.6, GLMT (GLM with Thinking), and Kimi for Coding models. The project features a modern React 19 web dashboard with real-time WebSocket integration, comprehensive TypeScript architecture, and cross-platform support. Current architecture includes:

- **TypeScript Core**: 43 source files with 100% type coverage
- **React 19 Dashboard**: Modern UI with Vite, shadcn/ui, and real-time features
- **AI Delegation System**: Headless execution with stream-JSON output
- **Cross-Platform**: Native support for macOS, Linux, and Windows
- **163 total files**: ~8,000 lines of TypeScript code

## Product Vision

### Mission Statement
Provide developers with instant, zero-downtime switching between AI models, optimizing for cost, performance, and rate limit management while maintaining a seamless workflow experience.

### Core Value Proposition
- **Instant Switching**: One command to change AI models without file editing
- **Zero Downtime**: Never interrupt development workflow during model switches
- **Cost Optimization**: Use the right model for each task automatically
- **Developer Experience**: Maintain familiar Claude CLI interface with enhanced capabilities

## Product Development Requirements (PDR)

### Functional Requirements

#### FR-001: Profile Management
**Requirement**: System shall support instant switching between multiple AI model profiles
- **Priority**: High
- **Acceptance Criteria**:
  - Switch profiles with single command (`ccs glm`, `ccs`)
  - Maintain profile state until explicitly changed
  - Support unlimited profile configurations
  - Automatic profile detection from command arguments

#### FR-002: Configuration Management
**Requirement**: System shall provide automatic configuration management
- **Priority**: High
- **Acceptance Criteria**:
  - Auto-create configuration during installation
  - Support custom configuration paths via environment variables
  - Validate configuration file format and existence
  - Provide clear error messages for configuration issues

#### FR-003: Claude CLI Integration
**Requirement**: System shall seamlessly integrate with official Claude CLI
- **Priority**: High
- **Acceptance Criteria**:
  - Pass all arguments transparently to Claude CLI
  - Support all Claude CLI features and flags
  - Maintain identical user experience to native Claude CLI
  - Auto-detect Claude CLI installation location

#### FR-004: Cross-Platform Compatibility
**Requirement**: System shall work identically across all supported platforms
- **Priority**: High
- **Acceptance Criteria**:
  - Support macOS (Intel and Apple Silicon)
  - Support Linux distributions
  - Support Windows (PowerShell and Git Bash)
  - Consistent behavior and error handling across platforms

#### FR-005: Special Command Support
**Requirement**: System shall support special meta-commands for management
- **Priority**: Medium
- **Acceptance Criteria**:
  - `ccs --version` displays version and installation location
  - `ccs --help` shows usage information
  - **WIP**: `ccs --install` integrates with Claude Code commands (testing incomplete)
  - **WIP**: `ccs --uninstall` removes Claude Code integration (testing incomplete)

#### FR-006: Error Handling
**Requirement**: System shall provide clear, actionable error messages
- **Priority**: Medium
- **Acceptance Criteria**:
  - Validate configuration file existence and format
  - Detect Claude CLI availability and report issues
  - Provide suggestions for resolving common problems
  - Maintain consistent error message format

#### FR-007: AI-Powered Delegation System
**Requirement**: System shall enable headless AI task delegation with real-time tool tracking
- **Priority**: High
- **Acceptance Criteria**:
  - Execute Claude CLI in headless mode with `-p` flag
  - Parse stream-JSON output for real-time tool visibility
  - Track 13+ Claude Code tools (Bash, Read, Write, Edit, Glob, Grep, etc.)
  - Support session continuation (`:continue` suffix)
  - Display cost and duration statistics
  - Handle Ctrl+C signal properly (kill child processes)

#### FR-008: .claude/ Directory Symlinking
**Requirement**: System shall selectively symlink .claude/ directories for data sharing
- **Priority**: Medium
- **Acceptance Criteria**:
  - Symlink shared data: commands/, skills/, agents/
  - Keep profile-specific data isolated: settings.json, sessions/, todolists/, logs/
  - Windows fallback to directory copying when symlinks unavailable
  - Non-invasive installation (never modify ~/.claude/settings.json)
  - Idempotent installation (safe to run multiple times)

#### FR-009: Shell Completion
**Requirement**: System shall provide comprehensive shell completion across 4 shells
- **Priority**: Low
- **Acceptance Criteria**:
  - Support Bash, Zsh, Fish, PowerShell
  - Color-coded categories (profiles, commands, flags)
  - Profile-aware completions (glm, glmt, kimi, work, personal)
  - Easy installation via `--shell-completion` flag
  - Show installation instructions per shell

#### FR-010: Diagnostics and Maintenance
**Requirement**: System shall provide comprehensive health diagnostics
- **Priority**: Medium
- **Acceptance Criteria**:
  - `ccs doctor`: Validate installation, profiles, symlinks, API keys
  - `ccs sync`: Fix broken symlinks and directory structure
  - `ccs update`: Check for newer versions with smart notifications
  - Color-coded status indicators ([OK], [!], [X])
  - Actionable recommendations for issues

### Non-Functional Requirements

#### NFR-001: Performance
**Requirement**: System shall execute with minimal overhead
- **Priority**: High
- **Acceptance Criteria**:
  - Profile switching completes in < 100ms
  - Startup time < 50ms for any command
  - Memory footprint < 10MB during execution
  - No perceptible delay compared to native Claude CLI

#### NFR-002: Reliability
**Requirement**: System shall maintain 99.9% uptime during normal operations
- **Priority**: High
- **Acceptance Criteria**:
  - Handle edge cases gracefully without crashes
  - Maintain functionality across system reboots
  - Recover gracefully from temporary system issues
  - No memory leaks or resource exhaustion

#### NFR-003: Security
**Requirement**: System shall follow security best practices
- **Priority**: High
- **Acceptance Criteria**:
  - No shell injection vulnerabilities in process execution
  - Validate file paths to prevent traversal attacks
  - Use secure process spawning with argument arrays
  - No storage of sensitive credentials or API keys

#### NFR-004: Maintainability
**Requirement**: System shall be easy to maintain and extend
- **Priority**: Medium
- **Acceptance Criteria**:
  - Code complexity maintained at manageable levels
  - Comprehensive test coverage (>90%)
  - Clear documentation and code comments
  - Modular architecture supporting future enhancements

#### NFR-005: Usability
**Requirement**: System shall provide excellent developer experience
- **Priority**: Medium
- **Acceptance Criteria**:
  - Intuitive command structure matching CLI conventions
  - Clear help documentation and usage examples
  - Minimal learning curve for existing Claude CLI users
  - Consistent behavior across all use cases

## Technical Architecture

### System Components

#### Core Subsystems (v4.3.2)
1. **Main Entry Point** (`bin/ccs.js` ~800 lines): Command parsing, profile routing, delegation detection
2. **Auth System** (`bin/auth/` ~800 lines): Multi-account management (create, list, delete, switch)
3. **Delegation System** (`bin/delegation/` ~1,200 lines): AI-powered task delegation with stream-JSON
4. **GLMT System** (`bin/glmt/` ~700 lines): Thinking mode proxy and transformation
5. **Management System** (`bin/management/` ~600 lines): Config, instance, profile, shared data management
6. **Utilities** (`bin/utils/` ~1,500 lines): Symlink manager, validators, update checker, completion
7. **.claude/ Integration** (`~/.ccs/shared/`): Symlinked commands, skills, agents directories

#### v4.0-4.3.2 Major Enhancements
- **AI Delegation** (v4.0): Headless execution with stream-JSON output, session continuation
- **Selective Symlinking** (v4.1): Share .claude/ directories (commands, skills, agents)
- **Shell Completion** (v4.1.4): 4 shells supported with color-coded categories
- **Diagnostics** (v4.2): Doctor, sync, update commands for health checks
- **Stream-JSON Parser** (v4.3): Real-time tool tracking during delegation

### Data Flow (v4.3.2)

**Settings-based profiles (glm, kimi, glmt)**:
```mermaid
graph LR
    USER[ccs glm "task"] --> PARSE[Parse Args]
    PARSE --> DETECT[ProfileDetector]
    DETECT --> CONFIG[Read config.json]
    CONFIG --> EXEC[execClaude with --settings]
    EXEC --> CLAUDE[Claude CLI]
```

**Delegation execution (v4.0+)**:
```mermaid
graph LR
    USER[ccs glm -p "task"] --> DELEGATE[DelegationHandler]
    DELEGATE --> HEADLESS[HeadlessExecutor]
    HEADLESS --> STREAM[Parse stream-JSON]
    STREAM --> FORMAT[ResultFormatter]
    FORMAT --> SESSION[SessionManager save]
```

**Account-based profiles (work, personal)**:
```mermaid
graph LR
    USER[ccs work "task"] --> PARSE[Parse Args]
    PARSE --> DETECT[ProfileDetector]
    DETECT --> INSTANCE[InstanceManager.ensureInstance]
    INSTANCE --> EXEC[execClaude with CLAUDE_CONFIG_DIR]
    EXEC --> CLAUDE[Claude CLI reads from instance]
```

**Evolution Flow Comparison**:
- **v2.x**: Login → Encrypt → Store → Decrypt → Copy → Execute (6 steps)
- **v3.0**: Create instance → Login → Execute (3 steps, 50% reduction)
- **v4.x**: Add delegation routing → Stream-JSON parsing → Session persistence (extended capabilities)

### Configuration Architecture (v4.3.2)

**Settings-based Config** (`~/.ccs/config.json`):
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

**Shared Data Architecture** (v4.1+):
```
~/.ccs/shared/              # Symlinked to instance .claude/ directories
├── commands/               # Slash commands (shared across profiles)
├── skills/                 # Agent skills (shared across profiles)
└── agents/                 # Agent configs (shared across profiles)
```

**Account Profile Registry** (`~/.ccs/profiles.json`):
```json
{
  "version": "2.0.0",
  "profiles": {
    "work": {
      "type": "account",
      "created": "2025-11-09T10:00:00.000Z",
      "last_used": "2025-11-09T15:30:00.000Z"
    }
  },
  "default": "work"
}
```

**v3.0 Schema Simplification**:
- **Removed fields**: `vault`, `subscription`, `email` (not needed for login-per-profile)
- **Kept fields**: `type`, `created`, `last_used` (essential metadata only)
- **Rationale**: Credentials live in instance directories, no vault needed

**Instance Directory Structure** (v4.1+ with symlinking):
```
~/.ccs/instances/work/
├── .claude/
│   ├── commands@ → ~/.ccs/shared/commands/   # Symlink (v4.1+)
│   ├── skills@ → ~/.ccs/shared/skills/       # Symlink (v4.1+)
│   ├── agents@ → ~/.ccs/shared/agents/       # Symlink (v4.1+)
│   ├── settings.json                          # Profile-specific (isolated)
│   ├── sessions/                              # Profile-specific (isolated)
│   ├── todolists/                             # Profile-specific (isolated)
│   └── logs/                                  # Profile-specific (isolated)
├── .anthropic/            # SDK config
└── .credentials.json      # Login credentials (managed by Claude CLI)
```

- **Environment Override**: `CCS_CLAUDE_PATH` - Custom Claude CLI path
- **Auto-Creation**: Configuration generated automatically during installation

## Implementation Standards

### Code Quality Standards
- **YAGNI Principle**: Only implement features immediately needed
- **KISS Principle**: Maintain simplicity over complexity
- **DRY Principle**: Eliminate code duplication
- **Test Coverage**: >90% coverage for all critical paths
- **Documentation**: Clear code comments and external documentation

### Development Workflow
1. **Feature Development**: Implement following coding standards
2. **Testing**: Comprehensive unit and integration tests
3. **Documentation**: Update relevant documentation
4. **Quality Review**: Code review against standards checklist
5. **Release**: Version management and distribution

### Platform Support Matrix
| Platform | Version Support | Testing Coverage |
|----------|----------------|------------------|
| macOS | 10.15+ | Full |
| Linux | Ubuntu 18.04+, CentOS 7+ | Full |
| Windows | 10+ (PowerShell, Git Bash) | Full |

## Quality Assurance

### Testing Strategy
- **Unit Tests**: Individual module functionality
- **Integration Tests**: Cross-module interaction
- **Platform Tests**: OS-specific behavior validation
- **Edge Case Tests**: Error conditions and boundary cases
- **Performance Tests**: Resource usage and response time

### Quality Metrics
- **Code Coverage**: >90% line coverage
- **Complexity**: Maintain cyclomatic complexity < 10 per function
- **Performance**: Startup time < 50ms, memory < 10MB
- **Reliability**: <0.1% error rate in normal operations

## Deployment and Distribution

### Distribution Channels
- **npm Package**: Primary distribution channel (`@kaitranntt/ccs`)
- **Direct Install**: Platform-specific install scripts
- **GitHub Releases**: Source code and binary distributions

### Installation Methods
1. **npm Package** (Recommended): `npm install -g @kaitranntt/ccs`
2. **Direct Install**: `curl -fsSL ccs.kaitran.ca/install | bash`
3. **Windows PowerShell**: `irm ccs.kaitran.ca/install | iex`

### Auto-Configuration Process
1. **Package Installation**: npm or direct script execution
2. **Post-install Hook**: Automatic configuration creation
3. **Path Setup**: Add to system PATH when needed
4. **Validation**: Verify Claude CLI availability
5. **Ready State**: System ready for profile switching

## Success Metrics

### v4.3.2 Achievement Metrics
- **Delegation System**: AI-powered task execution with stream-JSON output
- **Tool Tracking**: 13+ Claude Code tools supported
- **Session Persistence**: `:continue` support for follow-up tasks
- **Shell Completion**: 4 shells supported (Bash, Zsh, Fish, PowerShell)
- **Diagnostics**: Doctor, sync, update commands for health checks
- **Symlinking**: Selective .claude/ directory sharing (commands, skills, agents)

### Adoption Metrics
- **Download Count**: npm package downloads per month
- **Installation Success Rate**: >95% successful installations
- **User Retention**: Monthly active users
- **Platform Distribution**: Usage across supported platforms
- **Delegation Usage**: Percentage of users utilizing `-p` flag
- **API Key Configuration**: Rate of users configuring GLM/Kimi/GLMT keys

### Performance Metrics (v4.3.2)
- **Profile Creation**: ~5-10ms (instance directory creation only)
- **Profile Activation**: ~5-10ms (no decryption overhead)
- **Delegation Startup**: <500ms (stream-JSON initialization)
- **Response Time**: Minimal overhead, direct Claude CLI execution
- **Error Rate**: <0.1% in normal operations
- **Reliability**: 99.9% uptime during normal operations

### Quality Metrics
- **Test Coverage**: >90% for all critical paths
- **Bug Reports**: Number and severity of reported issues
- **Fix Time**: Average time to resolve reported issues
- **User Satisfaction**: Feedback and ratings

## Risk Management

### Technical Risks
- **Claude CLI Changes**: API changes in official CLI
  - **Mitigation**: Maintain abstraction layer, monitor changes
- **Platform Compatibility**: OS-specific issues
  - **Mitigation**: Comprehensive testing, CI/CD across platforms
- **Dependency Issues**: npm package or system dependency problems
  - **Mitigation**: Minimal dependencies, regular testing

### Business Risks
- **Competition**: Similar tools emerging
  - **Mitigation**: Focus on simplicity and reliability
- **User Adoption**: Slow adoption rates
  - **Mitigation**: Clear documentation, easy installation
- **Maintenance Burden**: Ongoing maintenance costs
  - **Mitigation**: Simplified codebase, automated testing

## Future Roadmap

See [docs/project-roadmap.md](./project-roadmap.md) for detailed version history and future plans.

### Completed (v4.3.2)
- ✅ **AI Delegation System** (v4.0): Headless execution with stream-JSON
- ✅ **Selective Symlinking** (v4.1): Share .claude/ directories
- ✅ **Shell Completion** (v4.1.4): 4 shells with color-coded categories
- ✅ **Diagnostics** (v4.2): Doctor, sync, update commands
- ✅ **Session Continuation** (v4.3): `:continue` support
- ✅ **Vault Removal** (v3.0): Login-per-profile model
- ✅ **Platform Parity** (v3.0): Unified macOS/Linux/Windows behavior

### Active Development (v4.4-v4.5)
- **Delegation Improvements**: MCP tool integration, SQLite session storage
- **Performance Optimization**: Model selection based on task complexity
- **Enhanced Diagnostics**: Automated troubleshooting recommendations

### Future Considerations (v5.0+)
- **AI-Powered Features**: Automatic task classification, intelligent model selection
- **Enterprise Features**: Team profile sharing, usage analytics dashboard
- **Ecosystem Expansion**: Plugin system for custom models, CI/CD integration

## Compliance and Legal

### Licensing
- **MIT License**: Permissive open-source license
- **Third-party Dependencies**: All dependencies use compatible licenses
- **Attribution**: Proper attribution for all used components

### Privacy
- **Data Collection**: No personal data collection or transmission
- **Local Processing**: All processing happens locally
- **Configuration Privacy**: User configurations remain private

### Security
- **Code Review**: Regular security reviews and audits
- **Dependency Management**: Regular updates and vulnerability scanning
- **Secure Distribution**: Signed packages and secure distribution channels

## Conclusion

The CCS project demonstrates successful iterative evolution balancing simplification with enhanced capabilities:

### Evolution Summary
- **v2.x**: Vault-based credential encryption (~1,700 LOC)
- **v3.0**: Vault removal, login-per-profile (~1,100 LOC, 40% reduction)
- **v4.0-4.3.2**: AI delegation, .claude/ symlinking, stream-JSON (~8,477 LOC with enhanced features)

### v4.3.2 Architectural Benefits
1. **AI-Powered Delegation**: Headless execution with real-time tool tracking
2. **Selective Symlinking**: Shared .claude/ data (commands, skills, agents) across profiles
3. **Enhanced Diagnostics**: Doctor, sync, update commands for health checks
4. **Stream-JSON Parsing**: Real-time visibility into Claude Code tool usage
5. **Session Persistence**: Continue delegation sessions with `:continue` suffix
6. **Shell Completion**: 4 shells supported with color-coded categories
7. **Platform Parity**: Unified behavior across macOS/Linux/Windows

### Key Strengths (v4.3.2)
- **Modular Architecture**: Clear subsystem separation (auth, delegation, glmt, management, utils)
- **Non-Invasive Installation**: Never modifies ~/.claude/settings.json
- **Idempotent Operations**: Safe to run installation/sync multiple times
- **Cross-Platform Compatibility**: Unified behavior, Windows symlink fallback
- **Developer Experience**: Familiar Claude CLI interface with AI delegation
- **Maintainability**: Modular design, clear responsibilities
- **Performance**: Minimal overhead, direct CLI execution

### Breaking Changes (v3.x → v4.x)
- **Zero Breaking Changes**: v4.x fully backward compatible with v3.x
- **New Features**: Delegation, symlinking, diagnostics added without breaking existing workflows
- **Migration**: No migration required from v3.x to v4.x

The project is well-positioned for future growth with a solid architectural foundation, comprehensive AI delegation capabilities, and enhanced developer experience. The v4.x architecture provides a sustainable basis for continued enhancement while maintaining core principles of simplicity, reliability, and performance.