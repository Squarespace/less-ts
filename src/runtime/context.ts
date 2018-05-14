import {
  Buffer,
  Context,
  EOF,
  ExecEnv,
  Function,
  IBlock,
  IDefinition,
  Node,
  Options,
  NodeName,
  NodeType,
  Chars
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
    readonly chars: Chars
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
    this.buf += n;
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

  frames: IBlock[];
  protected bufindex: number = 0;

  constructor(
    readonly ctx: Context,
    initialStack: IBlock[]) {
    this.frames = initialStack || [];
  }

  copy(): ExecEnv {
    return new RuntimeExecEnv(this.ctx, this.frames.slice(0));
  }

  append(frames: IBlock[]): void {
    this.frames = this.frames.concat(frames);
  }

  dump(): string {
    const buf = this.newBuffer();
    const end = this.frames.length - 1;
    for (let i = end; i >= 0; i--) {
      buf.incr();
      buf.str(`${i}: `);
      this.frames[i].dump(buf);
      buf.str('\n');
    }
    return buf.toString();
  }

  resolveDefinition(name: string): IDefinition | undefined {
    const end = this.frames.length - 1;
    for (let i = end; i >= 0; i--) {
      const def = this.frames[i].resolveDefinition(name);
      if (def) {
        return def;
      }
    }
    return undefined;
  }

  push(n: BlockNode): void {
    this.frames.push(n.block);
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

export type NodeRenderer = (buf: Buffer, n: Node) => void;

export class RuntimeContext implements Context {

  // Buffer-related settings. Used for fast construction of new temp buffers.
  readonly indentSize: number;
  readonly compress: boolean;
  readonly fastcolor: boolean;
  readonly spacer: string;
  readonly chars: Chars;
  readonly strictMath: boolean;

  constructor(
    readonly opts: Options = { compress: false },
    readonly renderer: NodeRenderer
  ) {
    this.indentSize = opts.indentSize || 2;
    this.compress = opts.compress || false;
    this.fastcolor = opts.fastcolor === undefined ? true : opts.fastcolor;
    this.spacer = repeat(' ', this.indentSize);
    this.strictMath = opts.strictMath || false;
    this.chars = {
      listsep: this.compress ? ',' : ', ',
      rulesep: this.compress ? ':' : ': ',
      ruleend: this.compress ? ';' : ';\n',
      selectorsep: this.compress ? ',' : ',\n'
    };
  }

  enterMixin(): void {
    // TODO:
  }

  exitMixin(): void {
    // TODO:
  }

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
