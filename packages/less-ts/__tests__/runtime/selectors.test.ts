import { LessCompiler } from '../../src';
import { Combinator, Selector, Selectors, TextElement } from '../../src/model';
import { combineSelectors } from '../../src/runtime/combine';
import { cartesianProduct } from '../../src/runtime/utils';

test('cartesian product', () => {
  let i: any[][];

  i = [];
  expect(cartesianProduct(i)).toEqual([]);

  i = [[1, 2], [], ['a', 'b']];
  expect(cartesianProduct(i)).toEqual([
    [1, 'a'],
    [1, 'b'],
    [2, 'a'],
    [2, 'b'],
  ]);

  i = [[1, 2], [], ['a', 'b'], [], [true, false]];
  expect(cartesianProduct(i)).toEqual([
    [1, 'a', true],
    [1, 'a', false],
    [1, 'b', true],
    [1, 'b', false],
    [2, 'a', true],
    [2, 'a', false],
    [2, 'b', true],
    [2, 'b', false],
  ]);
});

test('combine', () => {
  const compiler = new LessCompiler({ compress: false });
  const ctx = compiler.context();
  const ancestors = new Selectors([
    new Selector([new TextElement(Combinator.DESC, '.foo'), new TextElement(Combinator.CHILD, '.quux')]),
    new Selector([new TextElement(Combinator.DESC, '.bar')]),
  ]);
  const current = new Selectors([new Selector([new TextElement(undefined, ':focus')])]);

  const { selectors } = combineSelectors(ancestors, current);
  expect(selectors.length).toEqual(2);
  expect(ctx.render(selectors[0])).toEqual('.foo > .quux:focus');
  expect(ctx.render(selectors[1])).toEqual('.bar:focus');
});

test('combine wildcards', () => {
  const compiler = new LessCompiler({ compress: false });
  const ctx = compiler.context();
  const ancestors = new Selectors([
    new Selector([new TextElement(Combinator.DESC, '.foo'), new TextElement(Combinator.CHILD, '.quux')]),
    new Selector([new TextElement(Combinator.DESC, '.bar')]),
  ]);
  const current = new Selectors([new Selector([new TextElement(undefined, '&'), new TextElement(undefined, '.classname')])]);
  const { selectors } = combineSelectors(ancestors, current);
  expect(selectors.length).toEqual(2);
  expect(ctx.render(selectors[0])).toEqual('.foo > .quux.classname');
  expect(ctx.render(selectors[1])).toEqual('.bar.classname');
});
