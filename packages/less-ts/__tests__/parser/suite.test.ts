import * as fs from 'fs';
import { join } from 'path';
import { LessCompiler, Node, Stylesheet } from '../../src';

const ROOT = join(__dirname, '../data/suite');

const COMPILER = new LessCompiler({
  compress: false,
  indentSize: 2,
  fastcolor: false
});

const buffer = () => COMPILER.context().newBuffer();

const compare = (name: string): void => {
  const src = join(ROOT, `less/${name}.less`);
  const source = fs.readFileSync(src).toString('utf-8').trimRight();
  const dst = join(ROOT, `css/${name}.css`);
  const expected = fs.readFileSync(dst).toString('utf-8').trimRight();
  const actual = COMPILER.compile(source);

  expect(actual).toEqual(expected);

  // Generate canonical representation and re-parse it, then compare

  let buf = buffer();
  let sheet = COMPILER.parse(source) as Node;
  sheet.repr(buf);
  const gen1 = buf.toString();

  sheet = COMPILER.parse(gen1) as Node;
  buf = buffer();
  sheet.repr(buf);
  const gen2 = buf.toString();
  expect(gen2).toEqual(gen1);
};

const CASES: string[] = [
  'charset',
  'color',
  'color-transparent',
  'color-warning',
  'comment',
  'dimension',
  'directive',
  'expression',
  'font-rule',
  'function-calc',
  'function-color',
  'function-css',
  'function-general',
  'function-unit',
  'grid-1',
  // 'import-1',
  // 'import-2',
  // 'import-3',
  'media',
  'mixin',
  'mixin-args',
  'mixin-guard-1',
  'mixin-important',
  'mixin-selectors',
  'operation',
  'ruleset',
  'selector',
  'selector-wildcards',
  'skippable',
  'unicode-range',
  'urls',
  'variables',
  'whitespace'
];

CASES.forEach(c => {
  test(`${c}.less`, () => {
    compare(c);
  });
});
