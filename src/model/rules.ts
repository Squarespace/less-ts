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

  protected evaluating: boolean = false;
  protected hasMixinPath: boolean = false;

  constructor(
    readonly selectors: Selectors,
    readonly block: Block) {
    super(NodeType.RULESET, block);
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
    const r = new Ruleset(selectors, this.block.copy());
    if (this.original) {
      r.original = this.original;
    }
    return r;
  }

  enter(): void {
    this.evaluating = true;
  }

  exit(): void {
    this.evaluating = false;
  }
}
