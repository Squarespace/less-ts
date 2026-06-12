import { Element, Expression, Features, Keyword, Selector, Selectors } from '../model';
import { cartesianProduct } from './utils';

const KEYWORD_AND = new Keyword('and');

// Selector complexity threshold. A combine that exceeds this many
// elements fails the compile (fixed levels) or drops the current
// selector (legacy levels).
const SELECTOR_THRESHOLD = 4096;

const selectorTooComplex = (): Error =>
  new Error('ExecuteError SELECTOR_TOO_COMPLEX: Selector exceeds the complexity threshold');

// Combines a set of selectors with its ancestors: the cartesian
// product with wildcard replacement.
//
// sharedBudget true spans one complexity counter across every flatten
// call, capping the combined selector set (the fixed-level contract).
// false gives each call a fresh counter, the released per-call
// overflow contract, which the legacy levels need for byte-parity.
export const combineSelectors = (ancestors: Selectors, current: Selectors, sharedBudget: boolean = false): Selectors => {
  const result = new Selectors([]);
  const complexity = [0];
  for (const selector of current.selectors) {
    // If selector does not have a wildcard, just prepend it to the ancestors.
    if (!selector.hasWildcard) {
      flatten([ancestors.selectors, [selector]], result, sharedBudget ? complexity : [0]);
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

    flatten(inputs, result, sharedBudget ? complexity : [0]);
  }
  return result;
};

// One flatten step of a combine. complexity carries the running element
// count; the combine decides whether the calls share it.
export const flatten = (selectors: Selector[][], result: Selectors, complexity: number[]): void => {
  const product = cartesianProduct(selectors);
  for (const tmp of product) {
    let flat: Element[] = [];
    for (const sel of tmp) {
      flat = flat.concat(sel.elements);
    }
    result.selectors.push(new Selector(flat));
    complexity[0] += flat.length;
    if (complexity[0] > SELECTOR_THRESHOLD) {
      throw selectorTooComplex();
    }
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
