import {
  Buffer,
  Context,
  ExecEnv,
  EOF,
  Function,
  IBlockNode,
  IDefinition,
  LessError,
  LessErrorEvent,
  Node,
  NodeRenderer,
  NodeType,
  Options,
  Separators
} from '../common';

import { BlockNode, Definition } from '../model';
import { FUNCTIONS } from '../plugins';
import { repeat, whitespace } from '../utils';

/**
 * Implementation of Buffer interface, used to render nodes into
 * strings, generate a canonical representation of LESS syntax, etc
 */
export class RuntimeBuffer implements Buffer {

  // Buffer we're appending to
  protected buf: string = '';

  // Indent depth
  protected depth: number = 0;

  // Char at end of buffer
  prev: string = '\n';

  // Delimiter used to maintain state when we're emitting a quoted string
  delim: string = EOF;

  // Maximum number of digits after the decimal point for numbers
  numericScale: number = 8;

  constructor(
    readonly compress: boolean,
    readonly fastcolor: boolean,
    readonly spacer: string,
    readonly chars: Separators
  ) {
  }

  copy(): Buffer {
    return new RuntimeBuffer(
      this.compress,
      this.fastcolor,
      this.spacer,
      this.chars
    );
  }

  /**
   * Whether we're in escape mode.
   */
  inEscape(): boolean {
    return this.delim !== EOF;
  }

  /**
   * Begin string escape mode.
   */
  startEscape(delim: string): void {
    this.delim = delim;
  }

  /**
   * End string escape mode.
   */
  endEscape(): void {
    this.delim = EOF;
  }

  /**
   * Reset this buffer's state.
   */
  reset(): void {
    this.buf = '';
    this.depth = 0;
    this.prev = '\n';
    this.delim = EOF;
  }

  /**
   * Append a string to the buffer and set the 'prev' character.
   */
  str(s: string): Buffer {
    this.buf += s;
    this.prev = s[s.length - 1];
    return this;
  }

  /**
   * Append a number to the buffer, setting the 'prev' character to a digit.
   */
  num(n: number): Buffer {
    this.buf += n; // number should already have been clamped
    this.prev = '0'; // can be any digit
    return this;
  }

  /**
   * Add indentation to the buffer, using the current indent depth.
   */
  indent(): Buffer {
    for (let i = 0; i < this.depth; i++) {
      this.buf += this.spacer;
    }
    this.prev = ' ';
    return this;
  }

  /**
   * Increase indent depth.
   */
  incr(): void {
    this.depth++;
  }

  /**
   * Decrease indent depth.
   */
  decr(): void {
    this.depth--;
  }

  /**
   * Open a block and optionally increase the indent depth in compress mode.
   */
  blockOpen(): void {
    if (!this.compress && !whitespace(this.prev)) {
      this.buf += ' ';
    }
    this.buf += '{';
    if (!this.compress) {
      this.buf += '\n';
      this.incr();
    }
  }

  /**
   * Close a block and (optionally) decrease the indent depth in compress mode.
   */
  blockClose(): void {
    if (this.compress) {
      this.buf += '}';
    } else {
      this.decr();
      this.indent();
      this.buf += '}\n';
    }
  }

  /**
   * Return the internal string.
   */
  toString(): string {
    return this.buf;
  }
}

/**
 * Execution environment. This is used during evaluation, storing the
 * stack frames, supporting variable definition resolution, etc.
 */
export class RuntimeExecEnv implements ExecEnv {

  // Stack frames during evaluation
  frames: IBlockNode[];

  // Errors during evaluation
  errors: LessError[] = [];

  constructor(
    readonly ctx: Context,
    initialStack: IBlockNode[]) {
    this.frames = initialStack || [];
  }

  copy(): ExecEnv {
    return new RuntimeExecEnv(this.ctx, this.frames.slice(0));
  }

  append(frames: IBlockNode[]): void {
    this.frames = this.frames.concat(frames);
  }

  dump(): string {
    const buf = this.newBuffer();
    const end = this.frames.length - 1;
    for (let i = end; i >= 0; i--) {
      buf.incr();
      buf.str(`${i}: `);
      this.frames[i].block.dump(buf);
      buf.str('\n');
    }
    return buf.toString();
  }

  resolveDefinition(name: string): IDefinition | undefined {
    const end = this.frames.length - 1;
    if (this.ctx.nocache) {
      for (let i = end; i >= 0; i--) {
        const { rules } = this.frames[i].block;
        for (let j = rules.length - 1; j >= 0; j--) {
          const rule = rules[j];
          if (rule && rule.type === NodeType.DEFINITION) {
            const def = rule as Definition;
            if (def.name === name) {
              return def;
            }
          }
        }
      }
    } else {
      for (let i = end; i >= 0; i--) {
        const def = this.frames[i].block.resolveDefinition(name);
        if (def) {
          return def;
        }
      }
    }
    return undefined;
  }

  push(n: BlockNode): void {
    this.frames.push(n);
  }

  pop(): void {
    this.frames.pop();
  }

  /**
   * Render a given node to a string.
   */
  render(n: Node): string {
    return this.ctx.render(n);
  }

  newBuffer(): Buffer {
    return this.ctx.newBuffer();
  }

}

const DEFAULT_MIXIN_RECURSION_LIMIT = 64;

/**
 * Context used for various purposes during parsing, evaluation and rendering.
 * Essentially it holds all of the options, accumulates errors, provides access
 * to configured buffers for rendering, creates instances of ExecEnv for evaluation,
 * etc.
 */
export class RuntimeContext implements Context {

  // Buffer-related settings. Used for fast construction of new temp buffers.

  // Number of spaces of indent for the CSS output or LESS canonical representation
  readonly indentSize: number;

  // Enable whitespace compression of the CSS output
  readonly compress: boolean;

  // If false, the engine will attempt to emit the most compact form for a color,
  // replacing the hex #xxxxxx representation with a keyword (or vice versa) if
  // that would be shorter. If true only hex values are emitted, which is faster.
  readonly fastcolor: boolean;

  // Pre-computed string used for indentation
  readonly spacer: string;

  // Set of characters used for replacement. These will differ when compression
  // is enabled, e.g. emit ": " vs ":"
  readonly chars: Separators;

  // Disable caching of variable references on blocks.
  readonly nocache: boolean;

  // Enable strict math mode
  readonly strictMath: boolean;

  // Cap on the maximum recursion depth (in LESS terms, not JS stack)
  readonly mixinRecursionLimit: number;

  // Errors that have occurred at runtime
  readonly errors: LessErrorEvent[] = [];

  // Current mixin depth
  mixinDepth: number = 0;

  constructor(
    readonly opts: Options = { compress: false },
    readonly renderer: NodeRenderer
  ) {
    this.indentSize = opts.indentSize || 2;
    this.compress = opts.compress || false;
    this.fastcolor = opts.fastcolor === undefined ? true : opts.fastcolor;
    this.spacer = repeat(' ', this.indentSize);
    this.strictMath = opts.strictMath || false;
    this.nocache = opts.nocache || false;
    this.mixinRecursionLimit = opts.mixinRecursionLimit || DEFAULT_MIXIN_RECURSION_LIMIT;
    this.chars = {
      listsep: this.compress ? ',' : ', ',
      rulesep: this.compress ? ':' : ': ',
      ruleend: this.compress ? ';' : ';\n',
      selectorsep: this.compress ? ',' : ',\n'
    };
  }

  /**
   * Copy all errors from the given execution environment to an array, including a
   * pointer to the stack as it exists at the time of the error.
   */
  captureErrors(node: Node, env: ExecEnv): void {
    if (env.errors.length > 0) {
      const errors = env.errors.splice(0);
      const stack = env.frames.slice(0);
      this.errors.push({
        errors,
        node,
        stack
      });
    }
  }

  /**
   * Build a new ExecEnv instance.
   */
  newEnv(): ExecEnv {
    return new RuntimeExecEnv(this, []);
  }

  /**
   * Build a new Buffer instance.
   */
  newBuffer(): Buffer {
    return new RuntimeBuffer(
      this.compress, this.fastcolor, this.spacer, this.chars
    );
  }

  /**
   * Render the given node to a string. Note that this only handles non-Block nodes.
   */
  render(n: Node): string {
    const buf = this.newBuffer();
    this.renderer(buf, n);
    return buf.toString();
  }

  /**
   * Render a node into the given buffer.
   */
  renderInto(buf: Buffer, n: Node): void {
    this.renderer(buf, n);
  }

  /**
   * Return the implementation of the function with the given name, if it exists.
   */
  findFunction(name: string): Function | undefined {
    return FUNCTIONS[name];
  }
}
