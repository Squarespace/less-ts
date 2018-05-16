import { Buffer, Context, ExecEnv, Node, NodeType } from '../common';
import { Combinator, Element, TextElement, ValueElement } from './element';
import { arrayEquals, whitespace } from '../utils';

export class Selector extends Node {

  readonly hasWildcard: boolean;
  readonly evaluate: boolean;
  readonly mixinPath: string[] | undefined;

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
    this.mixinPath = renderSelectorPath(this);
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
    return new Selector(tmp);
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

/**
 * Render a selector into an array of path segments that can be used for
 * mixin resolution.
 */
export const renderSelectorPath = (selector: Selector, ctx?: Context): string[] | undefined => {
  const { elements } = selector;
  const len = elements.length;
  if (len === 0) {
    return;
  }
  let result: string[] | undefined;
  for (let i = 0; i < len; i++) {
    const elem = elements[i];
    if (elem.isWildcard()) {
      if (i === 0) {
        continue;
      }
      return;
    }

    const isText = elem instanceof TextElement;
    if (ctx === undefined && !isText) {
      return;
    }
    const isValue = elem instanceof ValueElement;
    if (!(isText || isValue)) {
      return;
    }

    if (result === undefined) {
      result = [];
    }
    if (isText) {
      result.push((elem as TextElement).name);
    } else if (isValue && ctx) {
      const text = ctx.render((elem as ValueElement).value);
      result.push(text);
    }
  }

  return result;
};
