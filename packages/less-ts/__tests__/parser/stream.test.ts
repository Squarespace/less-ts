import { formatParseError, LessCompiler, LessStream } from '../../src';

const COMPILER = new LessCompiler({});

const stream = (raw: string): LessStream => new LessStream(COMPILER.context(), raw);

test('anon rule value', () => {
  const stm = stream('foo bar;');
  expect(stm.matchAnonRuleValue()).toBe(true);
  expect(stm.token()).toEqual('foo bar');
});

test('bool operators', () => {
  let stm = stream('>=');
  expect(stm.matchBoolOperator()).toBe(true);
  expect(stm.token()).toEqual('>=');

  stm = stream('<=');
  expect(stm.matchBoolOperator()).toBe(true);
  expect(stm.token()).toEqual('<=');
});

test('call name', () => {
  const stm = stream('rgba(');
  expect(stm.matchCallName()).toBe(true);
  expect(stm.token()).toEqual('rgba');
});

test('color', () => {
  const stm = stream('#000');
  expect(stm.matchHexColor()).toBe(true);
  expect(stm.token()).toEqual('#000');

  // The run must be exactly 3 or 6 hex digits: any other length fails
  // the match so the value parses as an anonymous value and renders
  // verbatim.
  expect(stream('#000000').matchHexColor()).toBe(true);
  expect(stream('#0000').matchHexColor()).toBe(false);
  expect(stream('#00000').matchHexColor()).toBe(false);
  expect(stream('#0000000').matchHexColor()).toBe(false);
  expect(stream('#11223344').matchHexColor()).toBe(false);

  // 3/6-digit colors still parse and the bad runs pass through.
  const res = new LessCompiler({}).compile('.a { x: #0000 #fff #123456 #1234567; }\n');
  expect(res.errors.length).toBe(0);
  expect(res.css).toBe('.a {\n  x: #0000 #fff #123456 #1234567;\n}\n');
});

// Caret alignment in the windowed error display: the caret must point
// at the exact error column. '... ' is emitted only when the window
// actually truncates the start of the line, and the caret is
// compensated by the prefix width only in that case.

test('formatParseError short line (unwindowed)', () => {
  expect(formatParseError('abcd', 2)).toEqual(
    'Line   Statement\n----   ---------\n   1   abcd\n       ..^\n\nSyntaxError: INCOMPLETE_PARSE Unable to complete parse.\n'
  );
});

test('formatParseError error in first 37 chars of a long line', () => {
  // 76-char line, error at column 7: window starts at the line
  // beginning, so no '... ' prefix and the caret sits at column 7.
  const src = 'xxxxxxx ' + '!'.repeat(68);
  const out = formatParseError(src, 7);
  expect(out).toEqual(
    'Line   Statement\n----   ---------\n   1   ' + src.substring(0, 74) + '\n       .......^\n\nSyntaxError: INCOMPLETE_PARSE Unable to complete parse.\n'
  );
  const statement = out.split('\n')[2];
  expect(statement).not.toContain('...');
  expect(caretColumn(out)).toEqual(7);
});

test('formatParseError error in the tail of a long line (windowed)', () => {
  // 80-char line, error at column 70: window starts at column 33,
  // '... ' is emitted, and the caret compensates the prefix width.
  const src = '!'.repeat(40) + 'x'.repeat(40);
  const out = formatParseError(src, 70);
  const window = src.substring(33, 80);
  expect(out).toEqual(
    'Line   Statement\n----   ---------\n   1   ... ' + window + '\n       ' + '.'.repeat(41) + '^\n\nSyntaxError: INCOMPLETE_PARSE Unable to complete parse.\n'
  );
  expect(caretColumn(out)).toEqual(4 + (70 - 33));
});

test('formatParseError multi-line source', () => {
  const src = 'a: 1;\n.b { c: 2; }\nddd';
  // Error at absolute index 21: line 3, column 2.
  const out = formatParseError(src, 21);
  expect(out).toEqual(
    'Line   Statement\n----   ---------\n   1   a: 1;\n   2   .b { c: 2; }\n   3   ddd\n       ..^\n\nSyntaxError: INCOMPLETE_PARSE Unable to complete parse.\n'
  );
});

// Column of the caret relative to the statement content (the 7-space
// position/indent prefix is stripped).
const caretColumn = (out: string): number => {
  const line = out.split('\n').find((l) => l.trimEnd().endsWith('^')) as string;
  return line.indexOf('^') - 7;
};

test('element', () => {
  const stm = stream('.foo-bar-baz');
  expect(stm.matchElement1()).toBe(true);
  expect(stm.token()).toEqual('.foo-bar-baz');
  expect(stm.matchElement1()).toBe(false);
  expect(stm.token()).toEqual('');
});

test('dimension value: the released grammar has no exponent', () => {
  // The legacy number: '1e3' is 1 + the identifier 'e3', '7E705E'
  // is 7 + 'E705E'. A unit after the number is unaffected.
  for (const [raw, number] of [
    ['1e3', '1'],
    ['7E705E', '7'],
  ] as Array<[string, string]>) {
    const stm = stream(raw);
    expect(stm.matchDimensionValueLegacy()).toBe(true);
    expect(stm.token()).toEqual(number);
  }
  for (const [raw, number, unit] of [
    ['10em', '10', 'em'],
    ['2ex', '2', 'ex'],
  ] as Array<[string, string, string]>) {
    const stm = stream(raw);
    expect(stm.matchDimensionValueLegacy()).toBe(true);
    expect(stm.token()).toEqual(number);
    expect(stm.matchDimensionUnit()).toBe(true);
    expect(stm.token()).toEqual(unit);
  }
});

test('dimension value: a fixed tokenizer takes the exponent into the number', () => {
  const stm = new LessStream(new LessCompiler({ compatLevel: 2 }).context(), '1.5e-3');
  expect(stm.matchDimensionValue()).toBe(true);
  expect(stm.token()).toEqual('1.5e-3');
});

test('dimension value: the exponent needs a digit to follow', () => {
  // A unit after the number is unaffected: 'e' followed by a letter
  // is not an exponent, so the number stops before the unit.
  for (const [raw, number, unit] of [
    ['10em', '10', 'em'],
    ['2ex', '2', 'ex'],
  ] as Array<[string, string, string]>) {
    const stm = new LessStream(new LessCompiler({ compatLevel: 2 }).context(), raw);
    expect(stm.matchDimensionValue()).toBe(true);
    expect(stm.token()).toEqual(number);
    expect(stm.matchDimensionUnit()).toBe(true);
    expect(stm.token()).toEqual(unit);
  }
});
