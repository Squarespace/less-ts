import {
  Combinator,
  LessCompiler,
  Node,
  Parselet,
  Selector,
  SELECTOR,
  TextElement,
} from '../../src';

const COMPILER = new LessCompiler({});

const parse = (raw: string): Node | undefined => COMPILER.parse(raw, SELECTOR);

test('selector', () => {
  const r = parse('.foo.bar');
  expect(r).toEqual(new Selector([
    new TextElement(Combinator.DESC, '.foo'),
    new TextElement(undefined, '.bar')
  ]));
});
