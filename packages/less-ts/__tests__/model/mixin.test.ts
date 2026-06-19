import { LessCompiler, Mixin, Stylesheet } from '../../src';

const SRC = '.m(@a) when (@a > 1px) { color: red; }\n';

const mixinOf = (compress: boolean): Mixin => {
  const compiler = new LessCompiler({ compress });
  const tree = compiler.parse(SRC) as Stylesheet;
  return tree.block.rules[0] as Mixin;
};

const repr = (mixin: Mixin, compress: boolean): string => {
  const buf = new LessCompiler({ compress }).context().newBuffer();
  mixin.repr(buf);
  return buf.toString();
};

describe('Mixin.repr', () => {
  test('the non-compress form', () => {
    expect(repr(mixinOf(false), false)).toEqual('.m(@a) when (@a > 1px) {\n  color: red;\n}\n');
  });

  test('the compress form closes with a right brace', () => {
    expect(repr(mixinOf(true), true)).toEqual('.m(@a) when (@a > 1px){color:red}');
  });

  test.each([false, true])('round-trip holds for compress=%s', (compress) => {
    const gen1 = repr(mixinOf(compress), compress);
    const compiler = new LessCompiler({ compress });
    const tree = compiler.parse(gen1) as Stylesheet;
    const gen2 = repr(tree.block.rules[0] as Mixin, compress);
    expect(gen2).toEqual(gen1);
  });
});
