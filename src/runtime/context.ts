import { Block, BlockNode, Buffer, Definition, ExecEnv } from '../model';
import { repeat } from '../utils';

export class RuntimeBuffer implements Buffer {

  protected buf: string = '';
  protected spacer: string;
  protected depth: number = 0;

  constructor(readonly indentSize: number, readonly compress: boolean = false) {
    this.spacer = repeat(' ', indentSize);
  }

  str(s: string): Buffer {
    this.buf += s;
    return this;
  }

  num(n: number): Buffer {
    this.buf += n;
    return this;
  }

  indent(): Buffer {
    for (let i = 0; i < this.depth; i++) {
      this.buf += this.spacer;
    }
    return this;
  }

  incr(): void {
    this.depth++;
  }

  decr(): void {
    this.depth--;
  }

  listsep(): Buffer {
    if (this.compress) {
      this.buf += ',';
    } else {
      this.buf += ', ';
    }
    return this;
  }

  prevchar(): string {
    const len = this.buf.length;
    // For purposes of rendering selectors cleanly, if the buffer is
    // empty we pretend that we've emitted a line.
    return len === 0 ? '\n' : this.buf[len - 1];
  }

  toString(): string {
    return this.buf;
  }
}

export class RuntimeExecEnv implements ExecEnv {

  protected frames: Block[];

  constructor(
    readonly ctx: Context,
    initialStack: Block[]) {
    this.frames = initialStack || [];
  }

  resolveDefinition(name: string): Definition | undefined {
    return undefined;
  }

  push(n: BlockNode): void {
    this.frames.push(n.block);
  }

  pop(): void {
    this.frames.pop();
  }
}

export class Options {

}

export class Context {

  newEnv(): ExecEnv {
    return new RuntimeExecEnv(this, []);
  }
}
