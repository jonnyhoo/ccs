/**
 * Type shims for incomplete external dependencies
 */

declare module 'cli-table3' {
  interface TableOptions {
    head?: string[];
    colWidths?: number[];
    colAligns?: ('left' | 'center' | 'right')[];
    style?: {
      head?: string[];
      border?: string[];
    };
    chars?: Record<string, string>;
  }

  class Table extends Array {
    constructor(options?: TableOptions);
    toString(): string;
  }

  export = Table;
}

// ora v9 has types but we want to ensure compatibility
declare module 'ora' {
  interface Options {
    text?: string;
    color?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';
    spinner?: string | object;
    stream?: NodeJS.WritableStream;
  }

  interface Ora {
    start(text?: string): Ora;
    stop(): Ora;
    succeed(text?: string): Ora;
    fail(text?: string): Ora;
    warn(text?: string): Ora;
    info(text?: string): Ora;
    text: string;
    color: string;
  }

  function ora(options?: string | Options): Ora;
  export = ora;
}

// gradient-string v2.x is CJS without bundled types
declare module 'gradient-string' {
  interface Gradient {
    (text: string): string;
    multiline(text: string): string;
  }

  interface GradientString {
    // Preset gradients
    atlas: Gradient;
    cristal: Gradient;
    teen: Gradient;
    mind: Gradient;
    morning: Gradient;
    vice: Gradient;
    passion: Gradient;
    fruit: Gradient;
    instagram: Gradient;
    retro: Gradient;
    summer: Gradient;
    rainbow: Gradient;
    pastel: Gradient;
    // Custom gradient creator
    (colors: string[]): Gradient;
    (...colors: string[]): Gradient;
  }

  const gradient: GradientString;
  export = gradient;
}
