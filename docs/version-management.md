# Version Management

## Overview

CCS uses a centralized version management system to ensure consistency across all components including npm package and shell installers.

## Version Locations

The version number must be kept in sync across these files:

1. **`VERSION`** - Primary version file (read by shell scripts at runtime)
2. **`package.json`** - npm package version (for npm installations)
3. **`installers/install.sh`** - Hardcoded for standalone installations (`curl | bash`)
4. **`installers/install.ps1`** - Hardcoded for standalone installations (`irm | iex`)

## Why Multiple Version Locations?

### npm Package (`package.json`)
When users run `npm install -g @kaitranntt/ccs`, npm uses the version from `package.json` for package management and dependency resolution.

### Shell Installers (Hardcoded versions)
When users run:
- `curl -fsSL ccs.kaitran.ca/install | bash`
- `irm ccs.kaitran.ca/install.ps1 | iex`

The installer script is downloaded and executed directly **without** other files. Therefore, installers must have a hardcoded version as fallback.

### VERSION File (Runtime)
For git-based installations or shell scripts, the VERSION file is read at runtime to display accurate version information, overriding hardcoded versions.

## Updating Version

### Automated Method (Recommended)

Use the provided script to bump the version automatically:

```bash
# Bump patch version (2.1.1 -> 2.1.2)
./scripts/bump-version.sh patch

# Bump minor version (2.1.1 -> 2.2.0)
./scripts/bump-version.sh minor

# Bump major version (2.1.1 -> 3.0.0)
./scripts/bump-version.sh major
```

This updates:
- VERSION file
- package.json (npm package version)
- installers/install.sh (hardcoded version)
- installers/install.ps1 (hardcoded version)

### Manual Method

If updating manually, update version in ALL four locations:

1. **VERSION file**:
   ```bash
   echo "2.4.6" > VERSION
   ```

2. **package.json** (line 4):
   ```json
   "version": "2.4.6",
   ```

3. **installers/install.sh** (line ~34):
   ```bash
   CCS_VERSION="2.4.6"
   ```

4. **installers/install.ps1** (line ~33):
   ```powershell
   $CcsVersion = "2.4.6"
   ```

## Release Checklist

When releasing a new version:

- [ ] Update version using `./scripts/bump-version.sh X.Y.Z`
- [ ] Review changes: `git diff`
- [ ] Run comprehensive tests: `npm test`
- [ ] ~~Test both installation methods if applicable~~ (Shell installers DEPRECATED)
- [ ] Update CHANGELOG.md with release notes
- [ ] Commit changes: `git commit -am "chore: bump version to X.Y.Z"`
- [ ] Push: `git push`
- [ ] ~~Verify CloudFlare worker serves updated installer~~ (Shell installers DEPRECATED)
- [ ] Publish to npm: `npm publish`

## Version Display

After installation, users can check version:

```bash
# Shows CCS version (from VERSION file if available)
ccs --version

# Shows Claude CLI version
ccs version
```

## Semantic Versioning

CCS follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features (backward compatible)
- **PATCH** (0.0.X): Bug fixes

Current version: **2.4.4**
- 2.4.0: Code simplification (38% reduction, 1,315→813 lines)
- 2.4.1: Postinstall script improvements
- 2.4.2: Cross-compatibility testing framework
- 2.4.3: Performance optimizations
- 2.4.4: npm package testing enhancements
- 2.4.4: Documentation updates and bug fixes

## Version Detection Priority

Different installation methods display versions differently:

1. **Shell Installation**: Reads VERSION file at runtime
2. **npm Package**: Uses package.json version
3. **Git Installation**: VERSION file overrides installer versions
4. **Fallback**: Installer hardcoded version used if no VERSION file

All methods report the same version number when properly synchronized.
