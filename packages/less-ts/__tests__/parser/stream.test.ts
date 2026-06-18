import { LessCompiler, LessStream } from '../../src';

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
