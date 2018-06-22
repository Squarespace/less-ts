import { Keyword, KEYWORD, LessCompiler, Node, NodeType } from '../../src';

const COMPILER = new LessCompiler({});

const parse = (raw: string): Node | undefined => COMPILER.parse(raw, KEYWORD);

test('keyword', () => {
  const r = parse('--brand-color');
  expect(r).toEqual(new Keyword('--brand-color', NodeType.KEYWORD));
});
