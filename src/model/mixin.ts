import { Buffer, ExecEnv, Node, NodeType } from '../common';
import { Block, BlockNode } from './block';
import { Guard } from './guard';
import { Selector, Selectors } from './selector';
import { arrayEquals, safeEquals } from '../utils';

export class Argument extends Node {

  constructor(readonly name: string, readonly value: Node) {
    super(NodeType.ARGUMENT);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.ARGUMENT
        && this.name === (n as Argument).name
        && this.value.equals((n as Argument).value);
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

  equals(n: Node): boolean {
    return n.type === NodeType.PARAMETER
        && this.name === (n as Parameter).name
        && this.value.equals((n as Parameter).value)
        && this.variadic === (n as Parameter).variadic;
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

  equals(n: Node): boolean {
    return n.type === NodeType.MIXIN_PARAMS
        && this.variadic === (n as MixinParams).variadic
        && this.required === (n as MixinParams).required
        && arrayEquals(this.params, (n as MixinParams).params);
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
  private entryCount: number = 0;

  constructor(
    readonly name: string,
    readonly params: MixinParams,
    readonly guard: Guard,
    readonly block: Block,
    original?: Mixin) {
      super(NodeType.MIXIN, block, original);
  }

  enter(): void {
    this.entryCount++;
  }

  exit(): void {
    this.entryCount--;
  }

  copy(): Mixin {
    const result = new Mixin(this.name, this.params, this.guard, this.block.copy(), this.original as Mixin);
    result.closure = this.closure;
    return result;
  }

  equals(n: Node): boolean {
    return n.type === NodeType.MIXIN
        && this.name === (n as Mixin).name
        && this.params.equals((n as Mixin).params)
        && this.guard.equals((n as Mixin).guard)
        && this.block.equals((n as Mixin).block);
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

  readonly evaluate: boolean;

  constructor(
    readonly delimiter: string,
    readonly args: Argument[]) {
    super(NodeType.MIXIN_ARGS);
    let evaluate = false;
    for (const arg of args) {
      evaluate = evaluate || arg.needsEval();
      if (evaluate) {
        break;
      }
    }
    this.evaluate = evaluate;
  }

  equals(n: Node): boolean {
    return n.type === NodeType.MIXIN_ARGS
        && this.delimiter === (n as MixinCallArgs).delimiter
        && arrayEquals(this.args, (n as MixinCallArgs).args);
  }

  needsEval(): boolean {
    return this.evaluate;
  }

  eval(env: ExecEnv): Node {
    // TODO:
    return this;
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

const EMPTY_ARGS = new MixinCallArgs(',', []);

export class MixinCall extends Node {

  readonly mixinPath: string[] | undefined;
  readonly args: MixinCallArgs;

  constructor(
    readonly selector: Selector,
    args: MixinCallArgs | undefined,
    readonly important: boolean | number) {
      super(NodeType.MIXIN_CALL);
      this.mixinPath = selector.mixinPath;
      this.args = args || EMPTY_ARGS;
  }

  equals(n: Node): boolean {
    return n.type === NodeType.MIXIN_CALL
        && this.important === (n as MixinCall).important
        && this.selector.equals((n as MixinCall).selector)
        && safeEquals(this.args, (n as MixinCall).args);
  }

  repr(buf: Buffer): void {
    Selectors.reprSelector(buf, this.selector);
    if (this.args) {
      this.args.repr(buf);
    }
  }
}
