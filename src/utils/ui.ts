/**
 * Central UI Abstraction Layer
 *
 * Provides semantic, TTY-aware styling for CLI output.
 * Wraps chalk, boxen, cli-table3, ora with consistent API.
 *
 * Constraints:
 * - NO EMOJIS (ASCII only: [OK], [X], [!], [i])
 * - TTY-aware (plain text in pipes/CI)
 * - Respects NO_COLOR environment variable
 *
 * @module utils/ui
 */

import type {
  BoxOptions,
  TableOptions,
  SpinnerOptions,
  SemanticColor,
  SpinnerController,
} from '../types/utils';

// =============================================================================
// ESM MODULE TYPES & LAZY LOADING
// =============================================================================

// Type definitions for dynamically imported modules (CJS-compatible versions)
// chalk@4.x, boxen@5.x are CJS, ora@5.x is CJS, listr2@3.x is CJS, gradient-string@2.x is CJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChalkInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BoxenFunction = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GradientStringInstance = any;
// ora v9 is ESM-only, imported dynamically at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OraModule = any;
// listr2 v9 is ESM-only, imported dynamically at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ListrClass = any;

// Module cache for lazy loading
let chalkModule: ChalkInstance | null = null;
let boxenModule: BoxenFunction | null = null;
let gradientModule: GradientStringInstance | null = null;
let oraModule: OraModule | null = null;
let listrModule: ListrClass | null = null;

// Initialization state
let initialized = false;

// =============================================================================
// COLOR PALETTE (Professional cyan-to-blue)
// =============================================================================

const COLORS = {
  primary: '#00ECFA', // Bright cyan
  secondary: '#0099FF', // Sky blue
  neutral: '#808080', // Gray
} as const;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize UI dependencies (call once at startup)
 * Uses dynamic imports for ESM packages in CommonJS project
 */
export async function initUI(): Promise<void> {
  if (initialized) return;

  try {
    // Dynamic import for ESM-only packages
    const [chalkImport, boxenImport, gradientImport, oraImport, listrImport] = await Promise.all([
      import('chalk'),
      import('boxen'),
      import('gradient-string'),
      import('ora'),
      import('listr2'),
    ]);

    // CJS modules: use .default if available (ESM interop), otherwise use module directly
    chalkModule = chalkImport.default || chalkImport;
    boxenModule = boxenImport.default || boxenImport;
    gradientModule = gradientImport.default || gradientImport;
    oraModule = oraImport.default || oraImport;
    listrModule = listrImport.Listr || listrImport.default?.Listr;
    initialized = true;
  } catch (_e) {
    // Fallback: UI works without colors if imports fail
    console.error('[!] UI initialization failed, using plain text mode');
    initialized = true;
  }
}

// =============================================================================
// TTY & COLOR DETECTION
// =============================================================================

/**
 * Check if colors should be used
 * Respects NO_COLOR and FORCE_COLOR environment variables
 */
function useColors(): boolean {
  // FORCE_COLOR overrides all checks
  if (process.env.FORCE_COLOR) return true;
  // NO_COLOR disables colors
  if (process.env.NO_COLOR) return false;
  // Otherwise, check if TTY
  return !!process.stdout.isTTY;
}

/**
 * Check if interactive mode (TTY + not CI)
 */
export function isInteractive(): boolean {
  return !!process.stdout.isTTY && !process.env.CI && !process.env.NO_COLOR;
}

// =============================================================================
// COLOR SYSTEM
// =============================================================================

/**
 * Apply semantic color to text
 */
export function color(text: string, semantic: SemanticColor): string {
  if (!chalkModule || !useColors()) return text;

  switch (semantic) {
    case 'success':
      return chalkModule.green.bold(text);
    case 'error':
      return chalkModule.red.bold(text);
    case 'warning':
      return chalkModule.yellow(text);
    case 'info':
      return chalkModule.cyan(text);
    case 'dim':
      return chalkModule.gray(text);
    case 'primary':
      return chalkModule.hex(COLORS.primary).bold(text);
    case 'secondary':
      return chalkModule.hex(COLORS.secondary)(text);
    case 'command':
      return chalkModule.yellow.bold(text);
    case 'path':
      return chalkModule.cyan.underline(text);
    default:
      return text;
  }
}

/**
 * Apply gradient to text (for headers)
 * Uses cyan-to-blue gradient for professional look
 */
export function gradientText(text: string): string {
  if (!gradientModule || !useColors()) return text;
  return gradientModule([COLORS.primary, COLORS.secondary])(text);
}

/**
 * Bold text
 */
export function bold(text: string): string {
  if (!chalkModule || !useColors()) return text;
  return chalkModule.bold(text);
}

/**
 * Dim text
 */
export function dim(text: string): string {
  if (!chalkModule || !useColors()) return text;
  return chalkModule.dim(text);
}

// =============================================================================
// STATUS INDICATORS (ASCII only - NO EMOJIS)
// =============================================================================

/**
 * Success indicator: [OK]
 */
export function ok(message: string): string {
  return `${color('[OK]', 'success')} ${message}`;
}

/**
 * Error indicator: [X]
 */
export function fail(message: string): string {
  return `${color('[X]', 'error')} ${message}`;
}

/**
 * Warning indicator: [!]
 */
export function warn(message: string): string {
  return `${color('[!]', 'warning')} ${message}`;
}

/**
 * Info indicator: [i]
 */
export function info(message: string): string {
  return `${color('[i]', 'info')} ${message}`;
}

// =============================================================================
// BOX RENDERING
// =============================================================================

/**
 * Fallback ASCII box renderer (when boxen not available)
 */
function renderAsciiBox(content: string, options: BoxOptions): string {
  const lines = content.split('\n');
  const maxLen = Math.max(...lines.map((l) => l.length), (options.title?.length || 0) + 4);
  const width = maxLen + 4;

  let result = '';
  const padding = options.padding ?? 1;

  // Top border with optional title
  if (options.title) {
    const titlePad = Math.floor((width - options.title.length - 4) / 2);
    result +=
      '+' +
      '-'.repeat(titlePad) +
      ' ' +
      options.title +
      ' ' +
      '-'.repeat(width - titlePad - options.title.length - 4) +
      '+\n';
  } else {
    result += '+' + '-'.repeat(width - 2) + '+\n';
  }

  // Padding top
  for (let i = 0; i < padding; i++) {
    result += '|' + ' '.repeat(width - 2) + '|\n';
  }

  // Content
  for (const line of lines) {
    const pad = width - line.length - 4;
    result += '| ' + line + ' '.repeat(Math.max(0, pad)) + ' |\n';
  }

  // Padding bottom
  for (let i = 0; i < padding; i++) {
    result += '|' + ' '.repeat(width - 2) + '|\n';
  }

  // Bottom border
  result += '+' + '-'.repeat(width - 2) + '+';

  return result;
}

/**
 * Render content in a styled box
 */
export function box(content: string, options: BoxOptions = {}): string {
  if (!boxenModule) {
    return renderAsciiBox(content, options);
  }

  const borderColor = useColors() ? options.borderColor || COLORS.primary : undefined;

  return boxenModule(content, {
    padding: options.padding ?? 1,
    margin: options.margin ?? 0,
    borderStyle: options.borderStyle || 'round',
    borderColor,
    title: options.title,
    titleAlignment: options.titleAlignment || 'center',
  });
}

/**
 * Render error box (red border)
 */
export function errorBox(content: string, title = 'ERROR'): string {
  return box(content, {
    title,
    borderColor: 'red',
    borderStyle: 'round',
    padding: 1,
    margin: 1,
  });
}

/**
 * Render info box (primary color border)
 */
export function infoBox(content: string, title?: string): string {
  return box(content, {
    title,
    borderColor: COLORS.primary,
    borderStyle: 'round',
    padding: 1,
  });
}

/**
 * Render warning box (yellow border)
 */
export function warnBox(content: string, title = 'WARNING'): string {
  return box(content, {
    title,
    borderColor: 'yellow',
    borderStyle: 'round',
    padding: 1,
  });
}

// =============================================================================
// TABLE RENDERING
// =============================================================================

// cli-table3 is CommonJS, use dynamic import pattern

const Table = require('cli-table3');

/**
 * Create styled table
 */
export function table(rows: string[][], options: TableOptions = {}): string {
  // Build table configuration
  const tableConfig: Record<string, unknown> = {
    wordWrap: options.wordWrap ?? true,
    chars:
      options.style === 'ascii'
        ? {
            top: '-',
            'top-mid': '+',
            'top-left': '+',
            'top-right': '+',
            bottom: '-',
            'bottom-mid': '+',
            'bottom-left': '+',
            'bottom-right': '+',
            left: '|',
            'left-mid': '+',
            mid: '-',
            'mid-mid': '+',
            right: '|',
            'right-mid': '+',
            middle: '|',
          }
        : {
            top: '─',
            'top-mid': '┬',
            'top-left': '┌',
            'top-right': '┐',
            bottom: '─',
            'bottom-mid': '┴',
            'bottom-left': '└',
            'bottom-right': '┘',
            left: '│',
            'left-mid': '├',
            mid: '─',
            'mid-mid': '┼',
            right: '│',
            'right-mid': '┤',
            middle: '│',
          },
  };

  // Only add head if provided (cli-table3 requires head length to match rows)
  if (options.head && options.head.length > 0) {
    tableConfig.head = options.head.map((h: string) => color(h, 'primary'));
  }

  // Only add colWidths if provided
  if (options.colWidths) {
    tableConfig.colWidths = options.colWidths;
  }

  const tableInstance = new Table(tableConfig);

  rows.forEach((row) => tableInstance.push(row));
  return tableInstance.toString();
}

// =============================================================================
// SPINNER / PROGRESS
// =============================================================================

/**
 * Create and start a spinner
 * Falls back to plain text output in non-TTY environments
 */
export async function spinner(options: SpinnerOptions | string): Promise<SpinnerController> {
  const opts = typeof options === 'string' ? { text: options } : options;
  const isEnabled = isInteractive();

  // Lazy load ora if not already loaded
  if (!oraModule && isEnabled) {
    try {
      oraModule = (await import('ora')).default;
    } catch (_e) {
      // Fallback to plain text
    }
  }

  if (oraModule && isEnabled) {
    const s = oraModule({
      text: opts.text,
      color: 'cyan',
      prefixText: opts.prefixText,
      isEnabled,
    }).start();

    return {
      succeed: (msg?: string) => s.succeed(msg || `${color('[OK]', 'success')} ${opts.text}`),
      fail: (msg?: string) => s.fail(msg || `${color('[X]', 'error')} ${opts.text}`),
      warn: (msg?: string) => s.warn(msg || `${color('[!]', 'warning')} ${opts.text}`),
      info: (msg?: string) => s.info(msg || `${color('[i]', 'info')} ${opts.text}`),
      update: (text: string) => {
        s.text = text;
      },
      stop: () => s.stop(),
    };
  }

  // Fallback: plain text (non-TTY)
  console.log(`[i] ${opts.text}...`);
  return {
    succeed: (msg?: string) => console.log(ok(msg || opts.text)),
    fail: (msg?: string) => console.log(fail(msg || opts.text)),
    warn: (msg?: string) => console.log(warn(msg || opts.text)),
    info: (msg?: string) => console.log(info(msg || opts.text)),
    update: (_text: string) => {
      /* no-op in non-TTY */
    },
    stop: () => {
      /* no-op */
    },
  };
}

// =============================================================================
// SECTION HEADERS
// =============================================================================

/**
 * Print section header with optional gradient
 */
export function header(text: string, useGradient = true): string {
  if (useGradient && useColors()) {
    return gradientText(text);
  }
  return bold(text);
}

/**
 * Print subsection header
 */
export function subheader(text: string): string {
  return color(text, 'primary');
}

/**
 * Print horizontal rule
 */
export function hr(char = '─', width = 60): string {
  if (!useColors()) {
    return '-'.repeat(width);
  }
  return dim(char.repeat(width));
}

/**
 * Print section header with ═══ borders
 * Format: ═══ Title ═══
 */
export function sectionHeader(title: string): string {
  const border = '═══';
  const headerText = `${border} ${title} ${border}`;
  // Use gradient + bold for visual appeal
  if (gradientModule && chalkModule && useColors()) {
    return chalkModule.bold(gradientModule([COLORS.primary, COLORS.secondary])(headerText));
  }
  // Fallback to bold primary color
  if (useColors() && chalkModule) {
    return chalkModule.hex(COLORS.primary).bold(headerText);
  }
  return headerText;
}

// =============================================================================
// TASK LISTS (Listr2 Integration)
// =============================================================================

/**
 * Detect if running inside Claude Code tool context
 *
 * Heuristics:
 * - No TTY (stdout captured)
 * - CI-like environment
 * - CLAUDE_CODE env var set
 */
export function isClaudeCodeContext(): boolean {
  return (
    !process.stdout.isTTY ||
    !!process.env.CI ||
    !!process.env.CLAUDE_CODE ||
    process.env.TERM === 'dumb'
  );
}

/**
 * Task list item interface
 */
export interface TaskItem<T> {
  title: string;
  task: (ctx: T) => Promise<void> | void;
  skip?: () => boolean | string;
}

/**
 * Task list options
 */
export interface TaskListOptions {
  concurrent?: boolean;
}

/**
 * Create a task list for progress display
 * Uses Listr2 in TTY mode, falls back to spinners in non-TTY
 */
export async function taskList<T>(tasks: TaskItem<T>[], options: TaskListOptions = {}): Promise<T> {
  // Lazy load Listr2 if not already loaded
  if (!listrModule && isInteractive()) {
    try {
      const listr2 = await import('listr2');
      listrModule = listr2.Listr;
    } catch (_e) {
      // Fallback to sequential execution with spinners
      return runTasksFallback(tasks);
    }
  }

  if (listrModule && isInteractive()) {
    // Determine renderer based on context
    // Use 'simple' in non-TTY, CI, or Claude Code context
    const useSimple = isClaudeCodeContext();

    const list = new listrModule(
      tasks.map((t) => ({
        title: t.title,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        task: async (ctx: any) => t.task(ctx),
        skip: t.skip,
      })),
      {
        concurrent: options.concurrent ?? false,
        renderer: useSimple ? 'simple' : 'default',
        rendererOptions: {
          showSubtasks: true,
          collapseSubtasks: false,
        },
      }
    );

    return list.run({} as T);
  }

  // Fallback: non-interactive or Listr2 not available
  return runTasksFallback(tasks);
}

/**
 * Fallback task runner (no Listr2)
 * Uses spinners for sequential task execution
 */
async function runTasksFallback<T>(tasks: TaskItem<T>[]): Promise<T> {
  const ctx = {} as T;

  for (const task of tasks) {
    if (task.skip) {
      const skipResult = task.skip();
      if (skipResult) {
        console.log(info(`${task.title} [skipped]`));
        continue;
      }
    }

    const spin = await spinner(task.title);
    try {
      await task.task(ctx);
      spin.succeed();
    } catch (e) {
      spin.fail(`${task.title}: ${(e as Error).message}`);
      throw e;
    }
  }

  return ctx;
}

// =============================================================================
// UNIFIED EXPORT OBJECT
// =============================================================================

export const ui = {
  // Initialization
  init: initUI,
  isInteractive,
  isClaudeCodeContext,

  // Colors
  color,
  gradientText,
  bold,
  dim,

  // Status indicators (ASCII only)
  ok,
  fail,
  warn,
  info,

  // Containers
  box,
  errorBox,
  infoBox,
  warnBox,
  table,

  // Progress
  spinner,
  taskList,

  // Headers
  header,
  subheader,
  sectionHeader,
  hr,
} as const;

export default ui;
