import { LessCompiler, LessParseError, Options, Stylesheet } from '../src';

test('basics', () => {
  const src = '@color: red;\n.parent {\n  color: @color;\n}\n';
  const c = new LessCompiler({ indentSize: 2, fastcolor: false });
  const tree = c.parse(src);
  expect(tree).not.toBe(undefined);
  const buf = c.context().newBuffer();
  (tree as Stylesheet).repr(buf);
  expect(buf.toString()).toEqual(src);
});

test('parse errors', () => {
  const src = '@color: red;1/0\n';
  const c = new LessCompiler({ indentSize: 2, fastcolor: false });
  expect(() => c.parse(src)).toThrow(LessParseError);
  expect(() => c.parse(src)).toThrow('Unable to complete parse');
});

// Inputs that used to throw raw Errors out of compile(); they must
// now come back as a parse event with empty css, and the message
// stays the complete report through the formatter.
test('compile parse errors', () => {
  const c = new LessCompiler({ indentSize: 2, fastcolor: false });
  // [source, known phrase in the message, options]
  const cases: Array<[string, string, Options]> = [
    ['@color: red;1/0', 'Unable to complete parse', {}],
    ['.a { x: ~`code`; }\n', 'inline JavaScript not supported', {}],
    ['.a { x: alpha(opacity=10%); }\n', 'Numeric values for alpha cannot have units', {}],
    ['.a { x: ~"line \n feed"; }\n', 'Quoted string contains a bare line feed', {}],
    ['.b(@a:); .b(@x) { x: 1; }\n', 'expected an expression', {}],
    ['garbage', 'stylesheet produced no output', { safeMode: true }],
  ];
  for (const [src, phrase, opts] of cases) {
    const res = new LessCompiler(opts).compile(src);
    expect(res.css).toEqual('');
    expect(res.errors.length).toEqual(1);
    expect(res.errors[0].errors.length).toEqual(1);
    expect(res.errors[0].errors[0].type).toEqual('parse');
    expect(res.errors[0].errors[0].message).toContain(phrase);
    expect(res.errors[0].errors[0].message).toEqual(c.formatErrors(res.errors)[0]);
  }
});

// The render-phase throw is out of scope for this change: a selector
// combination that overflows the complexity limit at the fixed level
// still propagates out of compile().
test('render-phase throws still escape compile', () => {
  // A 65-sibling grid nested 63 deep exceeds the combine limit at
  // level 2 (the same shape as the eval-recovery overflow grid).
  const sels = Array.from({ length: 65 }, (_v, i) => '.a' + i).join(', ');
  let nested = '';
  for (let i = 0; i < 63; i++) {
    nested += '.b' + i + ' {\n';
  }
  nested += 'color: red;\n';
  for (let i = 0; i < 63; i++) {
    nested += '}\n';
  }
  const grid = sels + ' {\n' + nested + '}\n';
  expect(() => new LessCompiler({ compatLevel: 2 }).compile(grid)).toThrow(
    'ExecuteError SELECTOR_TOO_COMPLEX: Selector exceeds the complexity threshold',
  );
});

test('compile errors', () => {
  const src = '@color: red;\n.parent {\n  font-size: @size;\n}\n';
  const c = new LessCompiler({ indentSize: 2, fastcolor: false });
  const res = c.compile(src);
  expect(res.errors.length).toEqual(1);
  const errs = c.formatErrors(res.errors);
  expect(errs[0]).toMatch(/Failed to locate a definition .+ variable @size/);
});
