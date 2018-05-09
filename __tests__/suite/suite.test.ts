import * as fs from 'fs';
import { join } from 'path';

import { Builder, Context, NodeJ, Options, Renderer, RuntimeContext, Stylesheet, Evaluator } from '../../src';

const ROOT = join(__dirname, '../data/css');
const JSON_EXT = '.json';

// const tests = fs.readdirSync(ROOT)
//   .filter(n => n.endsWith(JSON_EXT))
//   .map(n => n.slice(0, -JSON_EXT.length));

interface Root {
  strings: string[];
  root: NodeJ;
}

const load = (name: string): [Root, string] => {
  const raw = fs.readFileSync(join(ROOT, name + JSON_EXT)).toString('utf-8');
  const json = JSON.parse(raw) as Root;
  // const css = fs.readFileSync(join(ROOT, name + '.css')).toString('utf-8');
  const css = '';
  return [json, css];
};

const evaluate = (root: Root, opts: Options): void => {
  const builder = new Builder(root.strings);
  const sheet = builder.expand(root.root) as Stylesheet;

  const ctx = new RuntimeContext(opts);
  const evaluator = new Evaluator(ctx);
  // const result = sheet.eval(ctx.newEnv()) as Stylesheet;
  const env = ctx.newEnv();
  const result = evaluator.evaluateStylesheet(env, sheet);
  // console.log(result);
  const css = Renderer.render(ctx, result);
  console.log(css);
};

// const tests = ['selector-wildcards'];
const tests = ['comment'];

tests.forEach(n => {
  const opts: Options = {
    indentSize: 2,
    fastcolor: true,
    compress: false
  };
  const [json, repr] = load(n);
  test(`suite ${n}.css`, () => {
    const css = evaluate(json, opts);
  });
});
// test('test cases', () => {
//   console.log(tests);
//   load('grid-1');
// });
