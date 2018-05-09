import { Buffer, ExecEnv, Node, NodeType } from '../common';
import { Combinator, Element } from './element';
import { arrayEquals, whitespace } from '../utils';
import { renderSelectorPath } from '../runtime/selector';

export class Selector extends Node {

  readonly hasWildcard: boolean;
  readonly evaluate: boolean;
  private _mixinBuilt: boolean = false;
  private _mixinPath?: string[];

  constructor(readonly elements: Element[]) {
    super(NodeType.SELECTOR);
    let wildcard = false;
    let evaluate = false;
    for (const e of elements) {
      wildcard = wildcard || e.isWildcard();
      evaluate = evaluate || e.needsEval();
    }
    this.hasWildcard = wildcard;
    this.evaluate = evaluate;
  }

  equals(n: Node): boolean {
    return n.type === NodeType.SELECTOR
        && arrayEquals(this.elements, (n as Selector).elements);
  }

  repr(buf: Buffer): void {
    Selectors.reprSelector(buf, this);
  }

  needsEval(): boolean {
    return this.evaluate;
  }

  eval(env: ExecEnv): Node {
    if (!this.needsEval()) {
      return this;
    }
    const tmp: Element[] = [];
    for (const elem of this.elements) {
      tmp.push(elem.eval(env) as Element);
    }
    const result = new Selector(tmp);
    result.buildMixinPath();
    return result;
  }

  mixinPath(): string[] | undefined {
    this.buildMixinPath();
    return this._mixinPath;
  }

  private buildMixinPath(): void {
    if (!this._mixinBuilt) {
      this._mixinPath = renderSelectorPath(this);
      this._mixinBuilt = true;
    }
  }
}

export class Selectors extends Node {

  private _evaluate: boolean = false;
  private _hasMixinPath: boolean = false;

  constructor(readonly selectors: Selector[]) {
    super(NodeType.SELECTORS);
    for (const s of selectors) {
      if (s.mixinPath) {
        this._hasMixinPath = true;
        if (this._evaluate) {
          break;
        }
      }
      this._evaluate = this._evaluate || s.needsEval();
    }
  }

  hasMixinPath(): boolean {
    return this._hasMixinPath;
  }

  add(selector: Selector): void {
    this.selectors.push(selector);
    this._evaluate = this._evaluate || selector.needsEval();
    this._hasMixinPath = this._hasMixinPath || (selector.mixinPath !== undefined);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.SELECTORS
        && arrayEquals(this.selectors, (n as Selectors).selectors);
  }

  repr(buf: Buffer): void {
    const { selectors } = this;
    const len = selectors.length;
    let emitted = false;
    for (let i = 0; i < len; i++) {
      if (emitted) {
        buf.str(',');
        if (!buf.compress) {
          buf.str('\n').indent();
        }
      }
      const s = selectors[i];
      if (s) {
        emitted = true;
        Selectors.reprSelector(buf, s);
      }
    }
  }

  needsEval(): boolean {
    return this._evaluate;
  }

  eval(env: ExecEnv): Node {
    if (!this._evaluate) {
      return this;
    }
    const result = new Selectors([]);
    for (const s of this.selectors) {
      result.add(s.eval(env) as Selector);
    }
    return result;
  }

  static reprSelector(buf: Buffer, selector: Selector): void {
    const { elements } = selector;
    const len = elements.length;
    for (let i = 0; i < len; i++) {
      reprElement(buf, elements[i], i === 0);
    }
  }
}

const reprElement = (buf: Buffer, element: Element, isFirst: boolean): void => {
  const { comb } = element;
  if (typeof comb === 'string') {
    const isDescendant = comb === Combinator.DESC;
    if (isFirst) {
      if (!isDescendant) {
        buf.str(comb);
      }
    } else {
      if (!buf.compress && !isDescendant) {
        buf.str(' ');
      }
      if (!isDescendant || !whitespace(buf.prev)) {
        buf.str(comb);
      }
    }
    if (!buf.compress && !element.isWildcard() && !whitespace(buf.prev)) {
      buf.str(' ');
    }
  }
  element.repr(buf);
};
