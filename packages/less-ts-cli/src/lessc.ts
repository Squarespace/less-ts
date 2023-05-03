import * as fs from 'fs';
import { join } from 'path';
import * as yargs from 'yargs';
import { getPackageInfo } from './util';
import { LessCompiler, Options } from '@squarespace/less-ts';

const CWD = process.cwd();

const resolve = (path: string): string => (path.startsWith('/') ? path : join(CWD, path));

const load = (path: string): string => fs.readFileSync(path, { encoding: 'utf-8' });

interface Args {
  source: string;
  parse?: boolean;
  indent?: number;
  compress?: boolean;
  mixinRecursionLimit?: number;
}

const run = (y: yargs.Arguments): void => {
  const args = y as any as Args;
  const { parse, indent, compress, mixinRecursionLimit } = args;
  const opts: Options = {
    indentSize: indent,
    compress,
    mixinRecursionLimit,
  };
  const path = resolve(args.source);
  const source = load(path);
  const compiler = new LessCompiler(opts);

  try {
    if (parse) {
      const tree = compiler.parse(source);
      console.error(`Parse of '${path}' successful`);
    } else {
      const result = compiler.compile(source);
      console.log(result.css);
      for (const err of result.errors) {
        console.log(`Error ${err}`);
      }
    }
  } catch (e) {
    console.error(`An error occurred ${parse ? 'parsing' : 'compiling'} ${path}:\n`);
    console.error((e as any).message);
  }
};

export const main = () => {
  const pkg = getPackageInfo();
  yargs
    .command(
      '$0 <source>',
      '',
      (y: yargs.Argv) =>
        y.positional('source', {
          describe: 'path to source stylesheet',
          type: 'string',
        }),
      run
    )
    .option('p', {
      alias: 'parse',
      type: 'boolean',
      description: 'parse only',
    })
    .option('i', {
      alias: 'indent',
      type: 'number',
      default: 2,
      description: 'Number of spaces of indent',
    })
    .option('r', {
      alias: 'mixin-recursion-limit',
      type: 'number',
      default: 64,
      description: 'Sets the mixin recursion depth limit.',
    })
    .option('x', {
      alias: 'compress',
      type: 'boolean',
      description: 'Enables compressing whitespace (minification)',
    })
    .version(`lessc:${pkg.version}`)
    .help('help')
    .option('h', { alias: 'help' })
    .parse();
};
