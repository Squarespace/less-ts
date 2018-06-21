import {
  Comment,
  COMMENT,
  LessCompiler,
  Node,
  Parselet,
} from '../../src';

const COMPILER = new LessCompiler({});

const parse = (raw: string): Node | undefined => COMPILER.parse(raw, COMMENT);

test('comment', () => {
  let r = parse('\n// foo\n');
  expect(r).toEqual(new Comment(' foo', false, false));
  r = parse('\n/* bar\nbaz\n*/\n');
  expect(r).toEqual(new Comment(' bar\nbaz\n', true, false));
});
