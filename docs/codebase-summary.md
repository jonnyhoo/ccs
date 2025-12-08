# CCS Codebase Summary

## Overview

CCS (Claude Code Switch) is a TypeScript-based CLI tool that provides instant profile switching between multiple AI models (Claude Sonnet 4.5, GLM 4.6, GLMT, and Kimi). The project features a comprehensive architecture with TypeScript source, React UI dashboard, cross-platform shell scripts, and extensive automation. Current version includes a modern React 19 dashboard with real-time WebSocket integration, Vite build system, and shadcn/ui components.

## Repository Structure

```
ccs/
├── src/                      # TypeScript source code (43 files)
│   ├── ccs.ts               # Main entry point (593 lines)
│   ├── commands/            # Modular command handlers (7 files)
│   ├── auth/                # Authentication system (3 files)
│   ├── cliproxy/            # CLIProxy integration (6 files)
│   ├── delegation/          # AI delegation system (6 files)
│   ├── glmt/                # GLMT thinking mode (7 files)
│   ├── management/          # System management (5 files)
│   ├── utils/               # Utilities (6 files)
│   └── types/               # TypeScript definitions (6 files)
├── ui/                      # React 19 Dashboard (Vite + shadcn/ui)
│   ├── src/
│   │   ├── App.tsx          # Main React app
│   │   ├── components/      # UI components
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   └── *.tsx        # Custom components
│   │   ├── hooks/           # React hooks
│   │   ├── lib/             # Utilities
│   │   └── pages/           # Route pages
│   ├── public/              # Static assets
│   ├── package.json         # Dependencies
│   └── vite.config.ts       # Vite configuration
├── lib/                     # Cross-platform scripts
│   ├── ccs                  # Bash bootstrap
│   └── ccs.ps1              # PowerShell bootstrap
├── scripts/                 # Build and automation
│   ├── build.js             # TypeScript compilation
│   ├── postinstall.js       # Auto-configuration
│   └── sync-version.js      # Version sync
├── tests/                   # Test suites
│   ├── unit/                # Unit tests
│   ├── npm/                 # Package tests
│   └── native/              # Native install tests
└── docs/                    # Documentation
    ├── project-overview-pdr.md
    ├── code-standards.md
    ├── system-architecture.md
    └── project-roadmap.md
```

## Key Components

### TypeScript Core (src/)

1. **Main Entry Point** (`src/ccs.ts`)
   - Command parsing and routing
   - Profile detection logic
   - Delegation flag handling (`-p`)
   - GLMT proxy lifecycle management

2. **Modular Commands** (`src/commands/`)
   - `version-command.ts`: Version display
   - `help-command.ts`: Comprehensive help system
   - `install-command.ts`: Installation workflows
   - `doctor-command.ts`: System diagnostics
   - `sync-command.ts`: Configuration synchronization
   - `shell-completion-command.ts`: Shell completion
   - `update-command.ts`: Version updates with beta channel support

3. **Authentication System** (`src/auth/`)
   - Profile detection and validation
   - Multi-account management
   - Profile registry operations

4. **CLIProxy Integration** (`src/cliproxy/`)
   - OAuth-based provider integration
   - Binary manager for cliproxy executables
   - Auth handler for OAuth flows

5. **AI Delegation** (`src/delegation/`)
   - Headless Claude execution
   - Stream-JSON parsing
   - Real-time tool tracking
   - Session persistence

6. **GLMT System** (`src/glmt/`)
   - HTTP proxy for thinking mode
   - Format transformation (Anthropic ↔ OpenAI)
   - Reasoning content handling
   - Debug logging

7. **Management** (`src/management/`)
   - System diagnostics
   - Instance management
   - Shared data management
   - Recovery operations

8. **Utilities** (`src/utils/`)
   - Cross-platform helpers
   - Shell execution
   - Package manager detection
   - Update checking

### React Dashboard (ui/)

**Technology Stack**:
- React 19 with TypeScript
- Vite for fast development and building
- shadcn/ui component library (Radix UI + Tailwind)
- TanStack Query for server state
- Real-time WebSocket integration
- Dark mode support

**Key Pages**:
- Dashboard: Overview and status
- API Profiles: Model configuration
- CLIProxy: OAuth provider setup
- Accounts: Account management
- Health: System diagnostics
- Settings: Configuration
- Shared: Data sharing management

**Components**:
- Modern UI with responsive design
- Real-time updates via WebSocket
- Professional theme with consistent styling
- Accessibility-compliant components

### Cross-Platform Scripts (lib/)

1. **Bash Bootstrap** (`lib/ccs`)
   - Entrypoint for Unix/macOS
   - Delegates to Node.js via npx
   - Argument passthrough support

2. **PowerShell Bootstrap** (`lib/ccs.ps1`)
   - Windows PowerShell support
   - Parameter splatting for arguments
   - Cross-platform parity with bash

### Build & Automation (scripts/)

1. **Build System**
   - TypeScript compilation to dist/
   - Source maps and declarations
   - Linting and formatting

2. **Post-Installation**
   - Auto-configuration creation
   - Directory structure setup
   - Migration for version upgrades

3. **Quality Gates**
   - Type checking (strict mode)
   - ESLint validation
   - Test execution
   - Code formatting

## Technology Stack

### Core Technologies
- **TypeScript 5.3+**: 100% type coverage, zero `any` types
- **Node.js 14+**: Runtime environment
- **Bun**: Package manager (10-25x faster than npm)
- **React 19**: Modern UI with concurrent features
- **Vite**: Fast build tool and dev server

### UI Libraries
- **shadcn/ui**: Modern component library
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **React Router**: Client-side routing
- **TanStack Query**: Server state management

### Development Tools
- **ESLint**: Code linting with strict rules
- **Prettier**: Code formatting
- **Mocha**: Test framework
- **Chai**: Assertion library
- **Semantic Release**: Automated versioning

## Key Features

### Profile Management
- **Settings-based profiles**: glm, glmt, kimi
- **Account-based profiles**: work, personal
- **CLIProxy providers**: OAuth-based integration
- **Instant switching**: Zero-downtime profile changes

### AI Delegation System
- **Headless execution**: `-p` flag for delegation
- **Real-time tracking**: 13+ Claude Code tools
- **Stream-JSON parsing**: Live tool visibility
- **Session persistence**: `:continue` support
- **Cost tracking**: Usage statistics

### GLMT Thinking Mode
- **Embedded proxy**: HTTP server for format conversion
- **Reasoning support**: GLM 4.6 with thinking blocks
- **Debug logging**: File-based logging with timestamps
- **Configuration**: Temperature, max tokens, timeouts

### Web Dashboard
- **Real-time UI**: WebSocket for live updates
- **Modern interface**: Responsive, accessible design
- **Configuration**: Visual profile and settings management
- **Health monitoring**: System diagnostics dashboard
- **Dark mode**: Theme switching support

### Cross-Platform Support
- **Universal**: macOS, Linux, Windows
- **Shell completion**: Bash, Zsh, Fish, PowerShell
- **Consistent behavior**: Unified across platforms
- **Windows fallbacks**: Copy when symlinks unavailable

### Development Workflow
- **TypeScript strict**: Maximum type safety
- **Automated releases**: Semantic versioning
- **Quality gates**: Pre-commit validation
- **Comprehensive tests**: Unit, integration, native

## Architecture Patterns

### Modular Design
- **Single responsibility**: Each module focused
- **Clear interfaces**: TypeScript contracts
- **Dependency injection**: Testable architecture
- **Error boundaries**: Graceful error handling

### Configuration Management
- **Shared data**: Symlinks for commands, skills, agents
- **Isolated state**: Profile-specific sessions, logs
- **Auto-recovery**: Self-healing configurations
- **Migration support**: Seamless upgrades

### Performance Optimization
- **Lazy loading**: On-demand initialization
- **Stream processing**: Real-time parsing
- **Minimal overhead**: Direct CLI execution
- **Efficient builds**: Vite and Bun optimization

## Statistics (as of v4.5.0)

- **Total files**: 163 files
- **TypeScript files**: 43 source files
- **Lines of code**: ~8,000 lines TypeScript
- **Test coverage**: 90%+ critical paths
- **Platform support**: 3 OS (macOS, Linux, Windows)
- **Shell completions**: 4 shells supported
- **AI models**: 4+ models integrated
- **Languages**: TypeScript, React, Bash, PowerShell

## Development Standards

### Code Quality
- **Zero any types**: 100% type coverage
- **Strict ESLint**: All errors enforced
- **Pre-commit hooks**: Automated validation
- **Semantic releases**: Automated versioning

### Testing Strategy
- **Unit tests**: Module isolation
- **Integration tests**: Cross-module flows
- **Platform tests**: OS-specific behavior
- **Native tests**: Shell script validation

### Documentation
- **Living docs**: Updated with releases
- **Code examples**: Real usage patterns
- **Architecture docs**: System design
- **API references**: Complete coverage

## Future Roadmap

### v4.6-v4.7 (UI Enhancements)
- Sidebar redesign with modern UX
- Enhanced dashboard visualizations
- Real-time collaboration features
- Mobile-responsive improvements

### v5.0+ (Next Generation)
- AI-powered automation
- Plugin system
- Enterprise features
- Ecosystem expansion

This codebase demonstrates a mature, well-architected TypeScript application with modern React UI, comprehensive testing, and cross-platform support. The modular design enables easy maintenance and extension while maintaining high quality standards.