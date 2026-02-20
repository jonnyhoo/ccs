import { initUI, header, color, dim, errorBox } from './ui';
import { ERROR_CODES, getErrorDocUrl, ErrorCode } from './error-codes';

/**
 * Enhanced error manager with context-aware messages
 */
export class ErrorManager {
  /**
   * Show error code and documentation URL
   */
  static showErrorCode(errorCode: ErrorCode): void {
    console.error(dim(`Error: ${errorCode}`));
    console.error(dim(getErrorDocUrl(errorCode)));
    console.error('');
  }

  /**
   * Show Claude CLI not found error
   */
  static async showClaudeNotFound(): Promise<void> {
    await initUI();

    console.error('');
    console.error(
      errorBox(
        'Claude CLI not found\n\n' +
          'CCS requires Claude CLI to be installed\n' +
          'and available in PATH.',
        'ERROR'
      )
    );
    console.error('');

    console.error(header('SOLUTIONS'));
    console.error('');
    console.error('  1. Install Claude CLI');
    console.error(`     ${color('https://docs.claude.com/install', 'path')}`);
    console.error('');

    // Windows-specific guidance for native installer users
    if (process.platform === 'win32') {
      console.error('  2. If you used the Windows installer, run:');
      console.error(`     ${color('claude install', 'command')}`);
      console.error(dim('     This adds Claude to your PATH'));
      console.error('');
      console.error('  3. Verify installation');
      console.error(`     ${color('Get-Command claude', 'command')}`);
      console.error('');
      console.error('  4. Custom path (if installed elsewhere)');
      console.error(`     ${color('$env:CCS_CLAUDE_PATH="C:\\path\\to\\claude.exe"', 'command')}`);
    } else {
      console.error('  2. Verify installation');
      console.error(`     ${color('command -v claude', 'command')}`);
      console.error('');
      console.error('  3. Custom path (if installed elsewhere)');
      console.error(`     ${color('export CCS_CLAUDE_PATH="/path/to/claude"', 'command')}`);
    }
    console.error('');

    this.showErrorCode(ERROR_CODES.CLAUDE_NOT_FOUND);
  }

  /**
   * Show settings file not found error
   */
  static async showSettingsNotFound(settingsPath: string): Promise<void> {
    await initUI();

    const isClaudeSettings =
      settingsPath.includes('.claude') && settingsPath.endsWith('settings.json');

    console.error('');
    console.error(errorBox('Settings file not found\n\n' + `File: ${settingsPath}`, 'ERROR'));
    console.error('');

    if (isClaudeSettings) {
      console.error('This file is auto-created when you login to Claude CLI.');
      console.error('');
      console.error(header('SOLUTIONS'));
      console.error(`  ${color(`echo '{}' > ${settingsPath}`, 'command')}`);
      console.error(`  ${color('claude /login', 'command')}`);
      console.error('');
      console.error(dim('Why: Newer Claude CLI versions require explicit login.'));
    } else {
      console.error(header('SOLUTIONS'));
      console.error(`  ${color('npm install -g @kaitranntt/ccs --force', 'command')}`);
      console.error('');
      console.error(dim('This will recreate missing profile settings.'));
    }

    console.error('');
    this.showErrorCode(ERROR_CODES.CONFIG_INVALID_PROFILE);
  }

  /**
   * Show invalid configuration error
   */
  static async showInvalidConfig(configPath: string, errorDetail: string): Promise<void> {
    await initUI();

    console.error('');
    console.error(
      errorBox(
        'Configuration invalid\n\n' + `File: ${configPath}\n` + `Issue: ${errorDetail}`,
        'ERROR'
      )
    );
    console.error('');

    console.error(header('SOLUTIONS'));
    console.error('');
    console.error(`  ${dim('# Backup corrupted file')}`);
    console.error(`  ${color(`mv ${configPath} ${configPath}.backup`, 'command')}`);
    console.error('');
    console.error(`  ${dim('# Reinstall CCS')}`);
    console.error(`  ${color('npm install -g @kaitranntt/ccs --force', 'command')}`);
    console.error('');
    console.error(dim('Your profile settings will be preserved.'));
    console.error('');

    this.showErrorCode(ERROR_CODES.CONFIG_INVALID_JSON);
  }

  /**
   * Show profile not found error
   */
  static async showProfileNotFound(
    profileName: string,
    availableProfiles: string[],
    suggestions: string[] = []
  ): Promise<void> {
    await initUI();

    console.error('');
    console.error(errorBox(`Profile '${profileName}' not found`, 'ERROR'));
    console.error('');

    if (suggestions && suggestions.length > 0) {
      console.error(header('DID YOU MEAN'));
      suggestions.forEach((s) => console.error(`  ${color(s, 'command')}`));
      console.error('');
    }

    console.error(header('AVAILABLE PROFILES'));
    availableProfiles.forEach((line) => console.error(`  ${color(line, 'info')}`));
    console.error('');

    console.error(header('SOLUTIONS'));
    console.error('');
    console.error('  Use an existing profile:');
    console.error(`    ${color('ccs <profile> "your prompt"', 'command')}`);
    console.error('');
    console.error('  Create a new API profile:');
    console.error(`    ${color('ccs api create', 'command')}`);
    console.error('');

    this.showErrorCode(ERROR_CODES.PROFILE_NOT_FOUND);
  }

  /**
   * Show permission denied error
   */
  static async showPermissionDenied(filePath: string): Promise<void> {
    await initUI();

    console.error('');
    console.error(errorBox('Permission denied\n\n' + `Cannot write to: ${filePath}`, 'ERROR'));
    console.error('');

    console.error(header('SOLUTIONS'));
    console.error('');
    console.error(`  ${dim('# Fix ownership')}`);
    console.error(`  ${color('sudo chown -R $USER ~/.ccs ~/.claude', 'command')}`);
    console.error('');
    console.error(`  ${dim('# Fix permissions')}`);
    console.error(`  ${color('chmod 755 ~/.ccs ~/.claude', 'command')}`);
    console.error('');
    console.error(`  ${dim('# Retry installation')}`);
    console.error(`  ${color('npm install -g @kaitranntt/ccs --force', 'command')}`);
    console.error('');

    this.showErrorCode(ERROR_CODES.FS_CANNOT_WRITE_FILE);
  }
}
