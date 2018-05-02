import { Buffer, ExecEnv, Node, NodeType } from './types';
import { Quoted } from './quoted';

export const enum Combinator {
  CHILD = '>',
  DESC = ' ',
  NAMESPACE = '|',
  SIB_ADJ = '+',
  SIB_GEN = '~'
}

export abstract class Element extends Node {

  constructor(
    readonly comb: Combinator | undefined) {
    super();
  }

  type(): NodeType {
    return NodeType.ELEMENT;
  }

  abstract isWildcard(): boolean;
}

export class AttributeElement extends Element {

  constructor(comb: Combinator | undefined, readonly parts: Node[]) {
    super(comb);
  }

  repr(buf: Buffer): void {
    buf.str('[');
    for (const n of this.parts) {
      n.repr(buf);
    }
    buf.str(']');
  }

  isWildcard(): boolean {
    return false;
  }
}

export class TextElement extends Element {

  readonly wildcard: boolean;

  constructor(comb: Combinator | undefined, readonly name: string) {
    super(comb);
    this.wildcard = name === '&';
  }

  repr(buf: Buffer): void {
    buf.str(this.name);
  }

  isWildcard(): boolean {
    return this.wildcard;
  }
}

export class ValueElement extends Element {

  constructor(
    comb: Combinator | undefined,
    readonly value: Node) {
    super(comb);
  }

  isWildcard(): boolean {
    return false;
  }

  repr(buf: Buffer): void {
    const quoted = this.value instanceof Quoted;
    if (quoted) {
      buf.str('(');
    }
    this.value.repr(buf);
    if (quoted) {
      buf.str(')');
    }
  }

  needsEval(): boolean {
    return this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new ValueElement(this.comb, this.value.eval(env)) : this;
  }

}
