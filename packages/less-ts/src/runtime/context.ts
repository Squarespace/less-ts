import { CompatLevel, Patch } from '../compat';
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
  Separators,
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

  // Compat level for this compile, threaded from the context for
  // render-side gates
  constructor(
    readonly compress: boolean,
    readonly fastcolor: boolean,
    readonly spacer: string,
    readonly chars: Separators,
    readonly compat: CompatLevel,
  ) {}

  copy(): Buffer {
    return new RuntimeBuffer(this.compress, this.fastcolor, this.spacer, this.chars, this.compat);
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

  // Warnings ride the context ledger; they are picked up by the
  // next evaluated rule or definition and rendered as a comment
  // before it.
  addWarning(warning: string): void {
    this.ctx.addWarning(warning);
  }

  takeWarnings(): string[] {
    return this.ctx.drainWarnings();
  }

  constructor(readonly ctx: Context, initialStack: IBlockNode[]) {
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

  // Retained for compatibility with the v1.1.5 option set; color output
  // no longer varies with it.
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

  // Compat level for this compile: level 0 is the released surface.
  // Gates read compat.enabled(patch); the level and the per-site
  // overrides apply in either order.
  readonly compat: CompatLevel;

  // Errors that have occurred at runtime
  readonly errors: LessErrorEvent[] = [];

  // Recovery warnings recorded during this compile. Each exact
  // message is recorded once; the evaluator drains them when it
  // attaches them to the next evaluated rule or definition.
  readonly warnings: string[] = [];
  private readonly warningKeys = new Set<string>();

  // Per-compile warning budgets (see allowWarning): how many
  // warnings of each type, and in total, are emitted before the
  // rest are suppressed. 0 disables a limit.
  private readonly maxWarnings: number;
  private readonly maxWarningsPerType: number;
  private readonly warningEmitted = new Map<string, number>();
  private readonly warningSuppressed = new Map<string, number>();
  private totalWarningEmitted = 0;
  private totalWarningSuppressed = 0;

  // Current mixin depth
  mixinDepth: number = 0;

  constructor(readonly opts: Options = { compress: false }, readonly renderer: NodeRenderer) {
    this.indentSize = opts.indentSize || 2;
    this.compress = opts.compress || false;
    this.fastcolor = opts.fastcolor === undefined ? false : opts.fastcolor;
    this.spacer = repeat(' ', this.indentSize);
    this.strictMath = opts.strictMath || false;
    this.maxWarnings = opts.maxWarnings ?? 0;
    this.maxWarningsPerType = opts.maxWarningsPerType ?? 25;
    this.nocache = opts.nocache || false;
    this.mixinRecursionLimit = opts.mixinRecursionLimit || DEFAULT_MIXIN_RECURSION_LIMIT;
    // Level and overrides expand independently: withLevel keeps the
    // override set and withPatch keeps the level, so the result does
    // not depend on which option is named first.
    let compat = CompatLevel.at(opts.compatLevel ?? 0);
    const overrides = opts.compatPatches;
    if (overrides) {
      for (const id of Object.keys(overrides)) {
        if (overrides[id]) {
          compat = compat.withPatch(id as Patch);
        }
      }
    }
    this.compat = compat;
    this.chars = {
      listsep: this.compress ? ',' : ', ',
      rulesep: this.compress ? ':' : ': ',
      ruleend: this.compress ? ';' : ';\n',
      selectorsep: this.compress ? ',' : ',\n',
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
        stack,
      });
    }
  }

  /**
   * Record a recovery warning. Exact-message repeats are free; the
   * first sighting takes the dedupe key, then the per-compile
   * budgets decide whether it is recorded.
   */
  addWarning(warning: string): void {
    if (!this.warningKeys.has(warning)) {
      this.warningKeys.add(warning);
      if (this.allowWarning(warning)) {
        this.warnings.push(warning);
      }
    }
  }

  /**
   * The type bucket for a warning: evaluation warnings embed their
   * error type (ExecuteError INCOMPATIBLE_UNITS: ...); the recovery
   * prefixes bucket by phase; everything else is parse-recovery.
   */
  static warningType(warning: string): string {
    if (warning.startsWith('eval: dropped')) {
      return 'eval-drop';
    }
    if (warning.startsWith('render: skipped') || warning.startsWith('render: truncated')) {
      return 'render-skip';
    }
    const m = /(?:SyntaxError|ExecuteError)\s+([A-Z][A-Z0-9_]+)\s*:/.exec(warning);
    if (m) {
      return m[1];
    }
    return 'parse-recovery';
  }

  /**
   * Budget gate for recorded warnings: true when the warning may be
   * emitted. Suppressed counts track distinct messages only (dedupe
   * runs first), per type and in total.
   */
  private allowWarning(warning: string): boolean {
    if (this.maxWarningsPerType <= 0 && this.maxWarnings <= 0) {
      return true;
    }
    const type = RuntimeContext.warningType(warning);
    if (this.maxWarningsPerType > 0 && (this.warningEmitted.get(type) ?? 0) >= this.maxWarningsPerType) {
      this.warningSuppressed.set(type, (this.warningSuppressed.get(type) ?? 0) + 1);
      return false;
    }
    if (this.maxWarnings > 0 && this.totalWarningEmitted >= this.maxWarnings) {
      this.totalWarningSuppressed++;
      return false;
    }
    this.warningEmitted.set(type, (this.warningEmitted.get(type) ?? 0) + 1);
    this.totalWarningEmitted++;
    return true;
  }

  /**
   * One-line summary of budget-suppressed warnings, undefined when
   * nothing was suppressed. Emitted as a single trailing comment at
   * render end.
   */
  suppressedWarningSummary(): string | undefined {
    if (this.warningSuppressed.size === 0 && this.totalWarningSuppressed === 0) {
      return undefined;
    }
    const parts: string[] = [];
    let total = 0;
    this.warningSuppressed.forEach((count, type) => {
      parts.push(`${count} ${type}`);
      total += count;
    });
    if (this.totalWarningSuppressed > 0) {
      parts.push(`${this.totalWarningSuppressed} overall`);
      total += this.totalWarningSuppressed;
    }
    const limits: string[] = [];
    if (this.maxWarningsPerType > 0) {
      limits.push(`limit ${this.maxWarningsPerType} per type`);
    }
    if (this.maxWarnings > 0) {
      limits.push(`limit ${this.maxWarnings} overall`);
    }
    return `${total} warnings suppressed (${parts.join(', ')}); ${limits.join(', ')}`;
  }

  /**
   * Return and clear the recorded warnings, and the dedupe keys with
   * them: a warning raised after a drain is not a repeat.
   */
  drainWarnings(): string[] {
    const drained = this.warnings.slice(0);
    this.warnings.length = 0;
    this.warningKeys.clear();
    return drained;
  }

  /**
   * Clear the warning ledger without returning it. Called at the
   * start of each compile: a prior compile on a reused context that
   * failed after recording warnings (a drain never ran) must not
   * leak stale entries, nor suppress identical fresh warnings via
   * stale dedupe keys.
   */
  resetWarnings(): void {
    this.warnings.length = 0;
    this.warningKeys.clear();
    this.warningEmitted.clear();
    this.warningSuppressed.clear();
    this.totalWarningEmitted = 0;
    this.totalWarningSuppressed = 0;
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
    return new RuntimeBuffer(this.compress, this.fastcolor, this.spacer, this.chars, this.compat);
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
