import { Buffer, ExecEnv, Node, NodeType } from './types';

export class Alpha extends Node {

  constructor(readonly value: Node) {
    super();
  }

  type(): NodeType {
    return NodeType.ALPHA;
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
    super();
  }

  type(): NodeType {
    return NodeType.ANONYMOUS;
  }

  repr(buf: Buffer): void {
    buf.str(this.value);
  }
}

export class Assignment extends Node {

  constructor(
    readonly name: string,
    readonly value: Node) {
    super();
  }

  type(): NodeType {
    return NodeType.ASSIGNMENT;
  }

  repr(buf: Buffer): void {
    buf.str(this.name).str('=');
    this.value.repr(buf);
  }

  needsEval(): boolean {
    return this.needsEval();
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
    super();
  }

  type(): NodeType {
    return NodeType.COMMENT;
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

  protected hasBang(): boolean {
    return this.body !== '' && this.body[0] === '!';
  }
}

export class FunctionCall extends Node {

  constructor(
    readonly name: string,
    readonly args: Node[]) {
    super();
  }

  type(): NodeType {
    return NodeType.FUNCTION_CALL;
  }

  repr(buf: Buffer): void {
    buf.str(this.name).str('(');
    const args = this.args;
    const len = args.length;
    for (let i = 0; i < len; i++) {
      if (i > 0) {
        buf.listsep();
      }
      args[i].repr(buf);
    }
    buf.str(')');
  }

  eval(env: ExecEnv): Node {
    // TODO: resolve function impl

    // TODO:
    return this;
  }
}

export class Paren extends Node {

  constructor(readonly value: Node) {
    super();
  }

  type(): NodeType {
    return NodeType.PAREN;
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
    super();
  }

  type(): NodeType {
    return NodeType.PROPERTY;
  }

  repr(buf: Buffer): void {
    buf.str(this.name);
  }
}

export class Ratio extends Node {

  constructor(readonly value: string) {
    super();
  }

  type(): NodeType {
    return NodeType.RATIO;
  }

  repr(buf: Buffer): void {
    buf.str(this.value);
  }
}

export class Shorthand extends Node {

  constructor(
    readonly left: Node,
    readonly right: Node) {
    super();
  }

  type(): NodeType {
    return NodeType.SHORTHAND;
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
    super();
  }

  type(): NodeType {
    return NodeType.UNICODE_RANGE;
  }

  repr(buf: Buffer): void {
    buf.str(this.value);
  }
}

export class Url extends Node {

  constructor(readonly value: Node) {
    super();
  }

  type(): NodeType {
    return NodeType.URL;
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
