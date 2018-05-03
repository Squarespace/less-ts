import { Buffer, ExecEnv, Node, NodeType } from '../common';
import { Block, BlockNode } from './block';
import { Guard } from './guard';
import { Selector, Selectors } from './selector';

export class Argument extends Node {

  constructor(readonly name: string, readonly value: Node) {
    super(NodeType.ARGUMENT);
  }

  repr(buf: Buffer): void {
    if (typeof this.name === 'string') {
      buf.str(this.name);
      buf.str(': ');
    }
    this.value.repr(buf);
  }

  needsEval(): boolean {
    return this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new Argument(this.name, this.value.eval(env)) : this;
  }
}

export class Parameter extends Node {

  constructor(
    readonly name: string,
    readonly value: Node,
    readonly variadic: boolean | number) {
    super(NodeType.PARAMETER);
  }

  repr(buf: Buffer): void {
    if (typeof this.name === 'string') {
      buf.str(this.name);
      if (this.value) {
        buf.str(': ');
        this.value.repr(buf);
      } else if (this.variadic) {
        buf.str(' ...');
      }
    } else if (this.value) {
      this.value.repr(buf);
    } else if (this.variadic) {
      buf.str('...');
    }
  }
}

export class MixinParams extends Node {

  constructor(
    readonly params: Parameter[],
    readonly variadic: boolean | number,
    readonly required: number) {
    super(NodeType.MIXIN_PARAMS);
  }

  repr(buf: Buffer): void {
    const { params } = this;
    if (params) {
      const len = this.params.length;
      for (let i = 0; i < len; i++) {
        if (i > 0) {
          buf.str(', ');
        }
        params[i].repr(buf);
      }
    }
  }
}

export class Mixin extends BlockNode {

  closure?: ExecEnv;

  constructor(
    readonly name: string,
    readonly params: MixinParams,
    readonly guard: Guard,
    readonly block: Block) {
      super(NodeType.MIXIN, block);
  }

  repr(buf: Buffer): void {
    buf.str(this.name).str('(');
    if (this.params) {
      this.params.repr(buf);
    }
    buf.str(')');
    if (this.guard) {
      buf.str(' when ');
      this.guard.repr(buf);
    }
    if (buf.compress) {
      buf.str('{');
    } else {
      buf.str(' {\n');
    }
    buf.incr();
    this.block.repr(buf);
    buf.decr();
    if (buf.compress) {
      buf.str('{');
    } else {
      buf.indent().str('}\n');
    }
  }
}

export class MixinCallArgs extends Node {

  constructor(
    readonly delimiter: string,
    readonly args: Argument[]) {
    super(NodeType.MIXIN_ARGS);
  }

  repr(buf: Buffer): void {
    const { args } = this;
    buf.str('(');
    if (args) {
      const len = args.length;
      for (let i = 0; i < len; i++) {
        if (i > 0) {
          buf.str(this.delimiter);
          if (!buf.compress) {
            buf.str(' ');
          }
        }
        args[i].repr(buf);
      }
    }
    buf.str(')');
  }
}

export class MixinCall extends Node {

  constructor(
    readonly selector: Selector,
    readonly args: MixinCallArgs,
    readonly important: boolean | number) {
      super(NodeType.MIXIN_CALL);
  }

  repr(buf: Buffer): void {
    Selectors.reprSelector(buf, this.selector);
    if (this.args) {
      this.args.repr(buf);
    }
  }
}
