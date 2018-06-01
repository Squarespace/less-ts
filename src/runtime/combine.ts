import { Element, Expression, Features, Keyword, Selector, Selectors } from '../model';
import { cartesianProduct } from './utils';

const KEYWORD_AND = new Keyword('and');

/**
 * Merges a set of selectors with one or more ancestors. This computes the cartesian
 * product of the two sets of selectors, and handles wildcard replacement.
 */
export const combineSelectors = (ancestors: Selectors, current: Selectors): Selectors => {
  const result = new Selectors([]);
  for (const selector of current.selectors) {
    // If selector does not have a wildcard, just prepend it to the ancestors.
    if (!selector.hasWildcard) {
      flatten([ancestors.selectors, [selector]], result);
      continue;
    }

    // Otherwise, substitute the ancestors for each wildcard element found.
    const inputs: Selector[][] = [];
    let temp: Selector = new Selector([]);
    for (const elem of selector.elements) {
      if (elem.isWildcard()) {
        // Only expand wildcards when there is at least 1 ancestor selector
        if (ancestors.selectors.length > 0) {
          temp.elements.push(elem);
          inputs.push([temp]);
          inputs.push(ancestors.selectors);
          temp = new Selector([]);
        }
      } else {
        temp.elements.push(elem);
      }
    }

    if (temp.elements.length > 0) {
      inputs.push([temp]);
    }

    flatten(inputs, result);
  }
  return result;
};

export const flatten = (selectors: Selector[][], result: Selectors): void => {
  const product = cartesianProduct(selectors);
  for (const tmp of product) {
    let flat: Element[] = [];
    for (const sel of tmp) {
      flat = flat.concat(sel.elements);
    }
    result.selectors.push(new Selector(flat));
  }
};

/**
 * Merges a set of MEDIA features with one or more ancestors. This computes the cartesian
 * product of the two sets of features.
 */
export const combineFeatures = (ancestors: Features, current: Features): Features => {
  const result = new Features([]);
  for (const node of current.features) {
    const product = cartesianProduct([ancestors.features, [node]]);
    for (const nodes of product) {
      const exp = new Expression([]);
      const { values } = exp;
      const len = nodes.length;
      for (let i = 0; i < len; i++) {
        if (i > 0) {
          values.push(KEYWORD_AND);
        }
        values.push(nodes[i]);
      }
      result.features.push(exp);
    }
  }
  return result;
};
