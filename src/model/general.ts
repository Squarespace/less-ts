import { Buffer, ExecEnv, Function, Node, NodeType } from '../common';
import { arrayEquals } from '../utils';

export class Alpha extends Node {

  constructor(readonly value: Node) {
    super(NodeType.ALPHA);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.ALPHA && this.value.equals((n as Alpha).value);
  }

  repr(buf: Buffer): void {
    buf.str('alpha(opacity=');
    this.value.repr(buf);
    buf.str(')');
  }

  needsEval(): boolean {
    return this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new Alpha(this.value.eval(env)) : this;
  }

}

export class Anonymous extends Node {

  constructor(readonly value: string) {
    super(NodeType.ANONYMOUS);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.ANONYMOUS && this.value === (n as Anonymous).value;
  }

  repr(buf: Buffer): void {
    buf.str(this.value);
  }
}

export class Assignment extends Node {

  constructor(
    readonly name: string,
    readonly value: Node) {
    super(NodeType.ASSIGNMENT);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.ASSIGNMENT
        && this.name === (n as Assignment).name
        && this.value.equals((n as Assignment).value);
  }

  repr(buf: Buffer): void {
    buf.str(this.name).str('=');
    this.value.repr(buf);
  }

  needsEval(): boolean {
    return this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new Assignment(this.name, this.value.eval(env)) : this;
  }

}

export class Comment extends Node {

  constructor(
    readonly body: string,
    readonly block: boolean | number,
    readonly newline: boolean | number) {
    super(NodeType.COMMENT);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.COMMENT
        && this.body === (n as Comment).body
        && this.block === (n as Comment).block
        && this.newline === (n as Comment).newline;
  }

  repr(buf: Buffer): void {
    if (!buf.compress || (this.block && this.hasBang())) {
      if (this.block) {
        buf.str('/*').str(this.body).str('*/');
      } else {
        buf.str('//').str(this.body);
      }
      if (this.newline) {
        buf.str('\n');
      }
    }
  }

  hasBang(): boolean {
    return this.body !== '' && this.body[0] === '!';
  }
}

export class Directive extends Node {

  constructor(
    readonly name: string,
    readonly value: Node) {
    super(NodeType.DIRECTIVE);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.DIRECTIVE
        && this.name === (n as Directive).name
        && this.value.equals((n as Directive).value);
  }

  repr(buf: Buffer): void {
    buf.str(this.name);
    buf.str(' ');
    this.value.repr(buf);
  }

  needsEval(): boolean {
    return this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new Directive(this.name, this.value.eval(env)) : this;
  }
}

export class FunctionCall extends Node {

  readonly evaluate: boolean;

  constructor(
    readonly name: string,
    readonly args: Node[],
    readonly noImpl: boolean = false) {
    super(NodeType.FUNCTION_CALL);
    let evaluate = false;
    for (const arg of args) {
      if (arg.needsEval()) {
        evaluate = true;
        break;
      }
    }
    this.evaluate = evaluate;
  }

  equals(n: Node): boolean {
    return n.type === NodeType.FUNCTION_CALL
        && this.name === (n as FunctionCall).name
        && arrayEquals(this.args, (n as FunctionCall).args);
  }

  repr(buf: Buffer): void {
    buf.str(this.name).str('(');
    const args = this.args;
    const len = args.length;
    const { listsep } = buf.chars;
    for (let i = 0; i < len; i++) {
      if (i > 0) {
        buf.str(listsep);
      }
      args[i].repr(buf);
    }
    buf.str(')');
  }

  needsEval(): boolean {
    return !this.noImpl || this.evaluate;
  }

  eval(env: ExecEnv): Node {
    let func: Function | undefined;
    if (!this.noImpl) {
      // Check if this function is built-in.
      func = env.ctx.findFunction(this.name);
    }

    if (func !== undefined) {
      // We have an implementation, so call it.
      const args = this.evalArgs(env);
      const [ok, errors] = func.validate(env, args);
      if (!ok) {
        // Arguments failed to validate, so append an error and return
        for (const err of errors) {
          env.errors.push(err);
        }
        return this;
      }
      const result = func.invoke(env, args);
      if (result !== undefined) {
        return result;
      }
    }

    // We either failed to find a function implementation, or the function
    // returned undefined indicating it cannot be called for some reason.
    // Fall back to emitting the function's representation with its args
    // evaluated.
    return this.evaluate ? new FunctionCall(this.name, this.evalArgs(env), true) : this;
  }

  private evalArgs(env: ExecEnv): Node[] {
    const { args } = this;
    const len = args.length;
    if (len === 0) {
      return args;
    }
    const res: Node[] = [];
    for (const arg of args) {
      res.push(arg.eval(env));
    }
    return res;
  }
}

export class Paren extends Node {

  constructor(readonly value: Node) {
    super(NodeType.PAREN);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.PAREN && this.value.equals((n as Paren).value);
  }

  repr(buf: Buffer): void {
    buf.str('(');
    this.value.repr(buf);
    buf.str(')');
  }

  needsEval(): boolean {
    return this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new Paren(this.value.eval(env)) : this;
  }
}

export class Property extends Node {

  constructor(readonly name: string) {
    super(NodeType.PROPERTY);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.PROPERTY
        && this.name === (n as Property).name;
  }

  repr(buf: Buffer): void {
    buf.str(this.name);
  }
}

export class Ratio extends Node {

  constructor(readonly value: string) {
    super(NodeType.RATIO);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.RATIO && this.value === (n as Ratio).value;
  }

  repr(buf: Buffer): void {
    buf.str(this.value);
  }
}

export class Shorthand extends Node {

  constructor(
    readonly left: Node,
    readonly right: Node) {
    super(NodeType.SHORTHAND);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.SHORTHAND
        && this.left.equals((n as Shorthand).left)
        && this.right.equals((n as Shorthand).right);
  }

  repr(buf: Buffer): void {
    this.left.repr(buf);
    buf.str('/');
    this.right.repr(buf);
  }

  needsEval(): boolean {
    return this.left.needsEval() || this.right.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new Shorthand(this.left.eval(env), this.right.eval(env)) : this;
  }
}

export class UnicodeRange extends Node {

  constructor(readonly value: string) {
    super(NodeType.UNICODE_RANGE);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.UNICODE_RANGE && this.value === (n as UnicodeRange).value;
  }

  repr(buf: Buffer): void {
    buf.str(this.value);
  }
}

export class Url extends Node {

  constructor(readonly value: Node) {
    super(NodeType.URL);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.URL && this.value.equals((n as Url).value);
  }

  repr(buf: Buffer): void {
    buf.str('url(');
    this.value.repr(buf);
    buf.str(')');
  }

  needsEval(): boolean {
    return this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new Url(this.value.eval(env)) : this;
  }

}
