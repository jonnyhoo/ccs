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
