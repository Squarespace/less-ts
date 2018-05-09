import { Context, NodeType } from '../common';
import { Selector, TextElement, ValueElement } from '../model';

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
