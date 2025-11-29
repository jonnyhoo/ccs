/**
 * Simple Progress Indicator (no external dependencies)
 *
 * Features:
 * - ASCII-only spinner frames (cross-platform compatible)
 * - TTY detection (no spinners in pipes/logs)
 * - Elapsed time display
 * - CI environment detection
 */

interface ProgressOptions {
  frames?: string[];
  interval?: number;
}

export class ProgressIndicator {
  private message: string;
  private frames: string[];
  private frameIndex: number;
  private interval: NodeJS.Timeout | null;
  private startTime: number;
  private isTTY: boolean;

  /**
   * Create a progress indicator
   * @param message - Message to display
   * @param options - Options
   */
  constructor(message: string, options: ProgressOptions = {}) {
    this.message = message;
    // ASCII-only frames for cross-platform compatibility
    this.frames = options.frames || ['|', '/', '-', '\\'];
    this.frameIndex = 0;
    this.interval = null;
    this.startTime = Date.now();

    // TTY detection: only animate if stderr is TTY and not in CI
    this.isTTY = process.stderr.isTTY === true && !process.env.CI && !process.env.NO_COLOR;
  }

  /**
   * Start the spinner
   */
  start(): void {
    if (!this.isTTY) {
      // Non-TTY: just print message once
      process.stderr.write(`[i] ${this.message}...\n`);
      return;
    }

    // TTY: animate spinner
    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      process.stderr.write(`\r[${frame}] ${this.message}... (${elapsed}s)`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80); // 12.5fps for smooth animation
  }

  /**
   * Stop spinner with success message
   * @param message - Optional success message (defaults to original message)
   */
  succeed(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);

    if (this.isTTY) {
      // Clear spinner line and show success
      process.stderr.write(`\r[OK] ${finalMessage} (${elapsed}s)\n`);
    } else {
      // Non-TTY: just show completion
      process.stderr.write(`[OK] ${finalMessage}\n`);
    }
  }

  /**
   * Stop spinner with failure message
   * @param message - Optional failure message (defaults to original message)
   */
  fail(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;

    if (this.isTTY) {
      // Clear spinner line and show failure
      process.stderr.write(`\r[X] ${finalMessage}\n`);
    } else {
      // Non-TTY: just show failure
      process.stderr.write(`[X] ${finalMessage}\n`);
    }
  }

  /**
   * Update spinner message (while running)
   * @param newMessage - New message to display
   */
  update(newMessage: string): void {
    this.message = newMessage;
  }

  /**
   * Stop the spinner without showing success/failure
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;

      if (this.isTTY) {
        // Clear the spinner line
        process.stderr.write('\r\x1b[K');
      }
    }
  }
}

export default ProgressIndicator;
