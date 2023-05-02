import { Combinator, LessCompiler, Node, Parselet, Selector, Selectors, SELECTORS, TextElement } from '../../src';

const COMPILER = new LessCompiler({});

const parse = (raw: string): Node | undefined => COMPILER.parse(raw, SELECTORS);

test('selector', () => {
  const r = parse('.foo.bar, input.submit');
  expect(r).toEqual(
    new Selectors([
      new Selector([new TextElement(Combinator.DESC, '.foo'), new TextElement(undefined, '.bar')]),
      new Selector([new TextElement(Combinator.DESC, 'input'), new TextElement(undefined, '.submit')]),
    ])
  );
});
