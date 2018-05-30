import * as fs from 'fs';
import { join } from 'path';

import {
  Builder,
  Context,
  Evaluator,
  LessCompiler,
  NodeJ,
  Options,
  Renderer,
  RuntimeContext,
  Stylesheet
} from '../../src';

const ROOT = join(__dirname, '../data/suite/css');
const JSON_EXT = '.json';

const tests = fs.readdirSync(ROOT)
  .filter(n => n.endsWith(JSON_EXT))
  .map(n => n.slice(0, -JSON_EXT.length));

interface Root {
  strings: string[];
  root: NodeJ;
}

const load = (name: string): [Root, string] => {
  const raw = fs.readFileSync(join(ROOT, name + JSON_EXT)).toString('utf-8');
  const json = JSON.parse(raw) as Root;
  const css = fs.readFileSync(join(ROOT, name + '.css')).toString('utf-8');
  return [json, css];
};

const evaluate = (root: Root, opts: Options): string => {
  const builder = new Builder(root.strings);
  const sheet = builder.expand(root.root) as Stylesheet;

  const compiler = new LessCompiler(opts);
  const ctx = compiler.context();
  const evaluator = new Evaluator(ctx);
  const env = ctx.newEnv();
  const result = evaluator.evaluateStylesheet(env, sheet);
  return Renderer.render(ctx, result);
};

tests.forEach(n => {
  const opts: Options = {
    indentSize: 2,
    fastcolor: false,
    compress: false
  };
  test(`suite ${n}.css`, () => {
    const [json, repr] = load(n);
    const css = evaluate(json, opts);
    expect(css).toEqual(repr);
  });
});
