import { Buffer, ExecEnv, Node, NodeType } from './types';
import { Combinator, Element } from './element';
import { whitespace } from '../utils';

export const enum SelectorFlags {
  EVALUATE = 1,
  HAS_WILDCARD = 2,
  MIXIN_PATH_BUILT = 4
}

export class Selector extends Node {

  protected mixinPath?: string[];
  protected flags: number = 0;

  constructor(readonly elements: Element[]) {
    super();
  }

  type(): NodeType {
    return NodeType.SELECTOR;
  }

  repr(buf: Buffer): void {
    Selectors.reprSelector(buf, this);
  }

  eval(env: ExecEnv): Node {
    // TODO:
    return this;
  }

}

export class Selectors extends Node {

  constructor(readonly selectors: Selector[]) {
    super();
  }

  type(): NodeType {
    return NodeType.SELECTORS;
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

  eval(env: ExecEnv): Node {
    // TODO:
    return this;
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
      if (!isDescendant || !whitespace(buf.prevchar())) {
        buf.str(comb);
      }
    }
    if (!buf.compress && !element.isWildcard() && !whitespace(buf.prevchar())) {
      buf.str(' ');
    }
  }
  element.repr(buf);
};
