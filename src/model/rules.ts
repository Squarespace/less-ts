import { Buffer, ExecEnv, Node, NodeType } from '../common';
import { Block, BlockNode } from './block';
import { Selectors } from './selector';

export class Rule extends Node {

  constructor(
    readonly property: Node,
    readonly value: Node,
    readonly important: boolean | number
  ) {
    super(NodeType.RULE);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.RULE
        && this.important === (n as Rule).important
        && this.property.equals((n as Rule).property)
        && this.value.equals((n as Rule).value);
  }

  repr(buf: Buffer): void {
    this.property.repr(buf);
    buf.str(':');
    if (!buf.compress) {
      buf.str(' ');
    }
    this.value.repr(buf);
    if (this.important) {
      buf.str(' !important');
    }
  }

  needsEval(): boolean {
    return this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new Rule(this.property, this.value.eval(env), this.important) : this;
  }
}

export class Ruleset extends BlockNode {

  protected _evaluating: boolean = false;
  readonly hasMixinPath: boolean = false;

  constructor(
    readonly selectors: Selectors,
    readonly block: Block,
    original?: Ruleset
  ) {
    super(NodeType.RULESET, block, original);
    this.hasMixinPath = selectors.hasMixinPath();
  }

  equals(n: Node): boolean {
    return n.type === NodeType.RULESET
        && this.selectors.equals((n as Ruleset).selectors)
        && this.block.equals((n as Ruleset).block);
  }

  repr(buf: Buffer): void {
    this.selectors.repr(buf);
    if (buf.compress) {
      buf.str('{');
    } else {
      buf.str(' {\n');
    }
    buf.incr();
    this.block.repr(buf);
    buf.decr();
    if (buf.compress) {
      buf.str('}');
    } else {
      buf.indent().str('}\n');
    }
  }

  copy(env: ExecEnv): Ruleset {
    const selectors = this.selectors.eval(env) as Selectors;
    const r = new Ruleset(selectors, this.block.copy(), this.original as Ruleset);
    return r;
  }

  evaluating(): boolean {
    return this._evaluating;
  }

  enter(): void {
    this._evaluating = true;
  }

  exit(): void {
    this._evaluating = false;
  }
}
