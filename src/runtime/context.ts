import {
  Buffer,
  Context,
  ExecEnv,
  EOF,
  Function,
  IBlock,
  IBlockNode,
  IDefinition,
  LessError,
  LessErrorEvent,
  LessErrorType,
  Node,
  NodeName,
  NodeRenderer,
  NodeType,
  Options,
  Separators
} from '../common';

import { Block, BlockNode, Definition } from '../model';
import { FUNCTIONS } from '../plugins';
import { repeat, whitespace } from '../utils';

export class RuntimeBuffer implements Buffer {

  // Buffer we're appending to
  protected buf: string = '';

  // Indent depth
  protected depth: number = 0;

  // Char at end of buffer
  prev: string = '\n';

  delim: string = EOF;

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

  inEscape(): boolean {
    return this.delim !== EOF;
  }

  startEscape(delim: string): void {
    this.delim = delim;
  }

  endEscape(): void {
    this.delim = EOF;
  }

  reset(): void {
    this.buf = '';
    this.depth = 0;
    this.prev = '\n';
    this.delim = EOF;
  }

  str(s: string): Buffer {
    this.buf += s;
    this.prev = s[s.length - 1];
    return this;
  }

  num(n: number): Buffer {
    this.buf += n; // number should already have been clamped
    this.prev = '0'; // can be any digit
    return this;
  }

  indent(): Buffer {
    for (let i = 0; i < this.depth; i++) {
      this.buf += this.spacer;
    }
    this.prev = ' ';
    return this;
  }

  incr(): void {
    this.depth++;
  }

  decr(): void {
    this.depth--;
  }

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

  blockClose(): void {
    if (this.compress) {
      this.buf += '}';
    } else {
      this.decr();
      this.indent();
      this.buf += '}\n';
    }
  }

  toString(): string {
    return this.buf;
  }
}

export class RuntimeExecEnv implements ExecEnv {

  frames: IBlockNode[];
  errors: LessError[] = [];
  protected bufindex: number = 0;

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
    for (let i = end; i >= 0; i--) {
      const def = this.frames[i].block.resolveDefinition(name);
      if (def) {
        return def;
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

export class RuntimeContext implements Context {

  // Buffer-related settings. Used for fast construction of new temp buffers.
  readonly indentSize: number;
  readonly compress: boolean;
  readonly fastcolor: boolean;
  readonly spacer: string;
  readonly chars: Separators;
  readonly strictMath: boolean;
  readonly mixinRecursionLimit: number;

  readonly errors: LessErrorEvent[] = [];

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
    this.mixinRecursionLimit = opts.mixinRecursionLimit || DEFAULT_MIXIN_RECURSION_LIMIT;
    this.chars = {
      listsep: this.compress ? ',' : ', ',
      rulesep: this.compress ? ':' : ': ',
      ruleend: this.compress ? ';' : ';\n',
      selectorsep: this.compress ? ',' : ',\n'
    };
  }

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

  // error(error: LessError, env: ExecEnv): void {
  //   this.errors.push({
  //     ...error,
  //     stack: env.frames.slice(0),
  //   });
  // }

  newEnv(): ExecEnv {
    return new RuntimeExecEnv(this, []);
  }

  newBuffer(): Buffer {
    return new RuntimeBuffer(
      this.compress, this.fastcolor, this.spacer, this.chars
    );
  }

  render(n: Node): string {
    const buf = this.newBuffer();
    this.renderer(buf, n);
    return buf.toString();
  }

  renderInto(buf: Buffer, n: Node): void {
    this.renderer(buf, n);
  }

  findFunction(name: string): Function | undefined {
    return FUNCTIONS[name];
  }
}
