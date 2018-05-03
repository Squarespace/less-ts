import { Combinator, Selector, Selectors, TextElement } from '../../src/model';
import { RuntimeBuffer, RuntimeContext } from '../../src/runtime';
import { combineSelectors } from '../../src/runtime/combine';
import { cartesianProduct } from '../../src/runtime/utils';

test('cartesian product', () => {
  let i: any[][];

  i = [];
  expect(cartesianProduct(i)).toEqual([]);

  i = [ [1, 2], [], ['a', 'b'] ];
  expect(cartesianProduct(i)).toEqual([
    [1, 'a'], [1, 'b'], [2, 'a'], [2, 'b']
  ]);

  i = [ [1, 2], [], ['a', 'b'], [], [true, false] ];
  expect(cartesianProduct(i)).toEqual([
    [1, 'a', true],
    [1, 'a', false],
    [1, 'b', true],
    [1, 'b', false],
    [2, 'a', true],
    [2, 'a', false],
    [2, 'b', true],
    [2, 'b', false]
  ]);
});

test('combine', () => {
  const ctx = new RuntimeContext({ compress: false });
  const ancestors = new Selectors([
    new Selector([
      new TextElement(Combinator.DESC, '.foo'),
      new TextElement(Combinator.CHILD, '.quux')
    ]),
    new Selector([
      new TextElement(Combinator.DESC, '.bar')
    ])
  ]);
  const current = new Selectors([
    new Selector([
      new TextElement(undefined, ':focus')
    ])
  ]);
  const r = combineSelectors(ancestors, current);
  const buf = ctx.newBuffer();
  r.repr(buf);
  expect(buf.toString()).toEqual('.foo > .quux:focus,\n.bar:focus');
});

test('combine wildcards', () => {
  const ctx = new RuntimeContext({ compress: false });
  const ancestors = new Selectors([
    new Selector([
      new TextElement(Combinator.DESC, '.foo'),
      new TextElement(Combinator.CHILD, '.quux')
    ]),
    new Selector([
      new TextElement(Combinator.DESC, '.bar')
    ])
  ]);
  const current = new Selectors([
    new Selector([
      new TextElement(undefined, '&'),
      new TextElement(undefined, '.classname')
    ])
  ]);
  const r = combineSelectors(ancestors, current);
  const buf = ctx.newBuffer();
  r.repr(buf);
  console.log(buf.toString());
  // expect(buf.toString()).toEqual('');
});
