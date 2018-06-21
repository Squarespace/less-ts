import { Buffer, ExecEnv, IDefinition, Node, NodeType } from '../common';
import { varCircularRef, varUndefined } from '../errors';
import { Anonymous } from './general';

export class Definition extends Node implements IDefinition {

  private evaluating: boolean = false;

  constructor(
    readonly name: string,
    readonly value: Node) {
    super(NodeType.DEFINITION);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.DEFINITION
        && this.name === (n as Definition).name
        && this.value.equals((n as Definition).value);
  }

  repr(buf: Buffer): void {
    buf.str(this.name).str(': ');
    this.value.repr(buf);
  }

  eval(env: ExecEnv): Node {
    // Late binding. Definitions must be derefenced to get their value.
    return this;
  }

  dereference(env: ExecEnv): Node {
    if (this.evaluating) {
      env.errors.push(varCircularRef(this.name));
      return this.value;
    }

    this.evaluating = true;
    const result = this.value.eval(env);
    this.evaluating = false;
    return result;
  }
}

const EMPTY = new Anonymous('');

export class Variable extends Node {

  constructor(
    readonly name: string,
    readonly indirect: boolean | number,
    readonly curly: boolean | number = false) {
    super(NodeType.VARIABLE);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.VARIABLE
      && this.curly === (n as Variable).curly
      && this.name === (n as Variable).name;
  }

  repr(buf: Buffer): void {
    if (this.indirect) {
      buf.str('@');
    }
    buf.str('@');
    if (this.curly) {
      buf.str('{');
    }
    buf.str(this.name.substring(1));
    if (this.curly) {
      buf.str('}');
    }
  }

  needsEval(): boolean {
    return true;
  }

  eval(env: ExecEnv): Node {
    const { ctx } = env;
    const def = env.resolveDefinition(this.name);
    if (!def) {
      env.errors.push(varUndefined(this.name));
      return EMPTY;
    }

    const res = def.dereference(env);
    if (!this.indirect) {
      return res;
    }

    // Variable is escaped, so we need to build a new variable
    // reference whose name is the rendered name.
    const buf = ctx.newBuffer();
    buf.startEscape('"');
    ctx.renderInto(buf, res);
    return new Variable(`@${buf.toString()}`, 0, 0).eval(env);
  }
}
