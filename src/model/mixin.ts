import { Buffer, ExecEnv, Node, NodeType } from '../common';
import { Block, BlockNode } from './block';
import { Guard } from './guard';
import { Selector, Selectors } from './selector';
import { arrayEquals, safeEquals } from '../utils';

export class Argument extends Node {

  readonly name?: string;

  constructor(name: string | undefined, readonly value: Node) {
    super(NodeType.ARGUMENT);
    this.name = name || undefined;
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
    return this.value.needsEval() ? new Argument(this.name, this.value.eval(env)) : this;
  }
}

export class Parameter extends Node {

  readonly name: string | undefined;

  constructor(
    name: string | undefined,
    readonly value: Node | undefined,
    readonly variadic: boolean | number) {
    super(NodeType.PARAMETER);
    this.name = name === null ? undefined : name;
  }

  equals(n: Node): boolean {
    return n.type === NodeType.PARAMETER
        && this.name === (n as Parameter).name
        && this.variadic === (n as Parameter).variadic
        && safeEquals(this.value, (n as Parameter).value);
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

  needsEval(): boolean {
    return this.value !== undefined && this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    if (this.needsEval()) {
      let { value } = this;
      if (value !== undefined) {
        value = value.eval(env);
      }
      return new Parameter(this.name, value, this.variadic);
    }
    return this;
  }

}

export class MixinParams extends Node {

  readonly evaluate: boolean;
  readonly variadic: boolean;
  readonly required: number;

  constructor(readonly params: Parameter[]) {
    super(NodeType.MIXIN_PARAMS);
    let evaluate = false;
    let variadic = false;
    let required = 0;
    for (const param of params) {
      evaluate = evaluate || param.needsEval();
      if (param.variadic) {
        variadic = true;
      }
      if (!param.variadic && (param.name === undefined || (param.name !== undefined && param.value === undefined))) {
        required++;
      }
    }
    this.evaluate = evaluate;
    this.variadic = variadic;
    this.required = required;
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

  needsEval(): boolean {
    return this.evaluate;
  }

  eval(env: ExecEnv): Node {
    if (!this.needsEval()) {
      return this;
    }
    const tmp: Parameter[] = [];
    for (const param of this.params) {
      tmp.push(param.eval(env) as Parameter);
    }
    return new MixinParams(tmp);
  }

}

export class Mixin extends BlockNode {

  private _mixinPath: string[][];

  constructor(
    readonly name: string,
    readonly params: MixinParams,
    readonly guard: Guard,
    readonly block: Block,
    original?: Mixin) {
      super(NodeType.MIXIN, block, original);
      this._mixinPath = [ [name] ];
  }

  mixinPaths(): string[][] {
    return this._mixinPath;
  }

  copy(): Mixin {
    const result = new Mixin(this.name, this.params, this.guard, this.block.copy(), this.original as Mixin);
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

  protected evaluate: boolean = false;

  constructor(
    readonly delimiter: string,
    readonly args: Argument[]) {
    super(NodeType.MIXIN_ARGS);
    for (const arg of args) {
      this.evaluate = this.evaluate || arg.needsEval();
      if (this.evaluate) {
        break;
      }
    }
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
    if (!this.evaluate) {
      return this;
    }
    const res = new MixinCallArgs(this.delimiter, []);
    for (const arg of this.args) {
      res.add(arg.eval(env) as Argument);
    }
    return res;
  }

  add(arg: Argument): void {
    this.args.push(arg);
    this.evaluate = this.evaluate || arg.needsEval();
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
