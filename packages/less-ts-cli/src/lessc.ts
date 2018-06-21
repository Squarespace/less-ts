import * as fs from 'fs';
import { join } from 'path';
import * as yargs from 'yargs';
import { getPackageInfo } from './util';
import { LessCompiler, Options } from '@squarespace/less-ts';

const CWD = process.cwd();

const resolve = (path: string): string =>
  path.startsWith('/') ? path : join(CWD, path);

const load = (path: string): string =>
  fs.readFileSync(path, { encoding: 'utf-8' });

const run = (y: yargs.Arguments): void => {
  const { parse, indent, compress, mixinRecursionLimit } = y;
  const opts: Options = {
    indentSize: indent,
    compress,
    mixinRecursionLimit
  };
  const path = resolve(y.source);
  const source = load(path);
  const compiler = new LessCompiler(opts);

  try {
    if (parse) {
      const tree = compiler.parse(source);
      console.error(`Parse of '${path}' successful`);
    } else {
      const result = compiler.compile(source);
      console.log(result);
    }
  } catch (e) {
    console.error(`Error ${parse ? 'parsing' : 'compiling'} ${path}`);
  }
};

export const main = () => {
  const pkg = getPackageInfo();
  yargs
    .command('$0 <source>', '', (y: yargs.Argv) =>
      y.positional('source', {
        describe: 'path to source stylesheet',
        type: 'string'
      }), run)
    .option('p', {
      alias: 'parse',
      type: 'boolean',
      description: 'parse only' })
    .option('i', {
      alias: 'indent',
      type: 'number',
      default: 2,
      description: 'Number of spaces of indent' })
    .option('r', {
      alias: 'mixin-recursion-limit',
      type: 'number',
      default: 64,
      description: 'Sets the mixin recursion depth limit.' })
    .option('x', {
      alias: 'compress',
      type: 'boolean',
      description: 'Enables compressing whitespace (minification)' })
    .version(`lessc:${pkg.version}`)
    .help('help')
    .option('h', { alias: 'help' })
    .parse();
};
