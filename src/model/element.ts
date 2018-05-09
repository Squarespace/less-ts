import { Buffer, ExecEnv, Node, NodeType } from '../common';
import { Quoted } from './quoted';
import { arrayEquals } from '../utils';

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
    super(NodeType.ELEMENT);
  }

  abstract isWildcard(): boolean;
}

export class AttributeElement extends Element {

  constructor(comb: Combinator | undefined, readonly parts: Node[]) {
    super(comb);
  }

  equals(n: Node): boolean {
    return n instanceof AttributeElement
        && this.comb === (n as AttributeElement).comb
        && arrayEquals(this.parts, (n as AttributeElement).parts);
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

  equals(n: Node): boolean {
    return n instanceof TextElement
        && this.comb === (n as TextElement).comb
        && this.name === (n as TextElement).name;
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

  equals(n: Node): boolean {
    return n instanceof ValueElement
        && this.comb === (n as ValueElement).comb
        && this.value.equals((n as ValueElement).value);
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
