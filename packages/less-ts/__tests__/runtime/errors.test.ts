import * as fs from 'fs';
import { join } from 'path';

import {
  Builder,
  Context,
  Evaluator,
  LessCompiler,
  LessError,
  LessErrorEvent,
  NodeJ,
  Options,
  Renderer,
  RuntimeContext,
  Stylesheet,
} from '../../src';

const ROOT = join(__dirname, '../data/errors');
const JSON_EXT = '.json';

interface Root {
  strings: string[];
  root: NodeJ;
}

const OPTIONS: Options = {
  indentSize: 2,
  fastcolor: false,
  compress: false,
  mixinRecursionLimit: 10,
};

const load = (name: string): [Root, string] => {
  const raw = fs.readFileSync(join(ROOT, name + JSON_EXT)).toString('utf-8');
  const json = JSON.parse(raw) as Root;
  const expected = fs.readFileSync(join(ROOT, name + '.css')).toString('utf-8');
  return [json, expected.trim()];
};

const evaluate = (root: Root, opts: Options): [string, LessErrorEvent[]] => {
  const builder = new Builder(root.strings);
  const sheet = builder.expand(root.root) as Stylesheet;

  const compiler = new LessCompiler(opts);
  const ctx = compiler.context();
  const evaluator = new Evaluator(ctx);
  const env = ctx.newEnv();
  const result = evaluator.evaluateStylesheet(env, sheet);
  const css = Renderer.render(ctx, result);
  return [css.trim(), ctx.errors];
};

test('mixin-recursion', () => {
  const [json, expected] = load('mixin-recursion');
  const [actual, errors] = evaluate(json, OPTIONS);

  expect(expected).toEqual(actual);
  expect(errors.length).toEqual(1);
  // expect(errors[0].type).toEqual('runtime');
  // expect(errors[0].message).toContain('recursion limit of 10');
});

test('function arguments', () => {
  const [json, expected] = load('function-arguments');
  const [actual, errors] = evaluate(json, OPTIONS);
});
