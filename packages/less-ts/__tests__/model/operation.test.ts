import { LessCompiler, CompileResult } from '../../src';

const compile = (src: string): CompileResult => new LessCompiler({}).compile(src);
const firstError = (res: CompileResult): string | undefined =>
  res.errors.length ? res.errors[0].errors[0].message : undefined;

// Reference contract: a dimension minus or divided by a color is a strict
// error (the whole compile fails with the dimension as rendered in the
// message); a dimension plus or times a color swaps to color math.

test('dimension color subtract/divide is a strict error', () => {
  const sub = compile('.a { x: (10 - red); }\n');
  expect(sub.errors.length).toBe(1);
  expect(firstError(sub)).toBe(
    'ExecuteError BAD_COLOR_MATH: A color cannot be subtracted from 10',
  );

  const div = compile('.a { x: (10 / red); }\n');
  expect(div.errors.length).toBe(1);
  expect(firstError(div)).toBe(
    'ExecuteError BAD_COLOR_MATH: A color cannot divide 10',
  );
});

test('the error carries the dimension as rendered', () => {
  const unit = compile('.a { x: (10px - red); }\n');
  expect(firstError(unit)).toBe(
    'ExecuteError BAD_COLOR_MATH: A color cannot be subtracted from 10px',
  );

  const pct = compile('.a { x: (10% / red); }\n');
  expect(firstError(pct)).toBe(
    'ExecuteError BAD_COLOR_MATH: A color cannot divide 10%',
  );
});

test('keyword operands cast to color before the check', () => {
  const k = compile('.a { x: (10 - white); }\n');
  expect(firstError(k)).toBe(
    'ExecuteError BAD_COLOR_MATH: A color cannot be subtracted from 10',
  );
});

test('dimension color add/multiply swaps to color math', () => {
  expect(compile('.a { x: (red + 10); }\n').css).toBe('.a {\n  x: #ff0a0a;\n}\n');
  expect(compile('.a { x: (red * 10); }\n').css).toBe('.a {\n  x: red;\n}\n');
});

test('color first is color math for every operator', () => {
  expect(compile('.a { x: (red - 10); }\n').css).toBe('.a {\n  x: #f50000;\n}\n');
  expect(compile('.a { x: (red / 10); }\n').css).toBe('.a {\n  x: #190000;\n}\n');
});
