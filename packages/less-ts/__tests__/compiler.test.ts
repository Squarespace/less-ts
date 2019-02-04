import { LessCompiler, Stylesheet } from '../src';

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
  expect(() => c.parse(src)).toThrow('Unable to complete parse');
});

test('compile errors', () => {
  const src = '@color: red;\n.parent {\n  font-size: @size;\n}\n';
  const c = new LessCompiler({ indentSize: 2, fastcolor: false });
  const res = c.compile(src);
  expect(res.errors.length).toEqual(1);
  const errs = c.formatErrors(res.errors);
  expect(errs[0]).toMatch(/Failed to locate a definition .+ variable @size/);
});
