import * as fs from 'fs';
import { join } from 'path';
import * as yargs from 'yargs';
import { getPackageInfo } from './util';
import { LessCompiler, Options } from '@squarespace/less-ts';

const CWD = process.cwd();

const OK = 0;
const ERR = 1;

const resolve = (path: string): string => (path.startsWith('/') ? path : join(CWD, path));

interface Streams {
  out: NodeJS.WriteStream;
  err: NodeJS.WriteStream;
}

interface Args {
  source: string;
  parse?: boolean;
  indent?: number;
  compress?: boolean;
  mixinRecursionLimit?: number;
}

const buildArgv = (argv: string[]): yargs.Argv =>
  yargs(argv)
    .usage('$0 [options] <source>')
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
    .version(`slessc:${getPackageInfo().version}`)
    .help('help')
    .strict();

const run = (args: Args, streams: Streams): number => {
  const { parse, indent, compress, mixinRecursionLimit } = args;
  const base: Options = { indentSize: indent, compress, mixinRecursionLimit };
  const path = resolve(args.source);
  let source: string;
  try {
    source = fs.readFileSync(path, { encoding: 'utf-8' });
  } catch (e) {
    streams.err.write(`the path '${path}' cannot be read.\n`);
    return ERR;
  }
  try {
    if (parse) {
      // Parse-only stays strict: the recovery override below applies
      // to the compile path only.
      new LessCompiler(base).parse(source);
      streams.err.write(`Parse of '${path}' successful\n`);
      return OK;
    }
    // lessc compiles in recovery (safe) mode: a broken statement is
    // dropped with a warning instead of failing the run, matching the
    // reference CLI. The library default stays strict. A hard error,
    // including a recovery that rescues nothing, still fails.
    const compiler = new LessCompiler({ ...base, safeMode: true });
    const result = compiler.compile(source);
    streams.out.write(result.css);
    if (result.errors.length === 0) {
      return OK;
    }
    for (const m of compiler.formatErrors(result.errors)) {
      streams.err.write(m + '\n');
    }
    return ERR;
  } catch (e) {
    streams.err.write(`An error occurred ${parse ? 'parsing' : 'compiling'} ${path}:\n`);
    streams.err.write((e as Error).message + '\n');
    return ERR;
  }
};

/**
 * Runs the CLI against the given argument vector and returns the exit
 * code. All output goes to the injected streams; the bin entry exits
 * the process with the returned code.
 */
export const main = async (
  argv: string[],
  streams: Streams = { out: process.stdout, err: process.stderr }
): Promise<number> => {
  // Version and help are handled before the rest is parsed: their
  // output goes to the out stream and they exit 0. A '--' ends flag
  // scanning, so only flags before it count.
  const flagEnd = argv.indexOf('--');
  const flags = flagEnd === -1 ? argv : argv.slice(0, flagEnd);
  if (flags.includes('-v') || flags.includes('--version')) {
    streams.out.write(`slessc:${getPackageInfo().version}\n`);
    return OK;
  }
  if (flags.includes('-h') || flags.includes('--help')) {
    streams.out.write(await buildArgv([]).getHelp());
    return OK;
  }

  let code = OK;
  const help = await buildArgv(argv).getHelp();
  buildArgv(argv)
    .command(
      '$0 <source>',
      '',
      (y: yargs.Argv) =>
        y.positional('source', {
          describe: 'path to source stylesheet',
          type: 'string',
        }),
      (y: any) => {
        // After a '--' terminator yargs maps the path to _ rather than
        // the command positional, so fall back to it.
        const source = y.source !== undefined ? y.source : y._ && y._[0];
        if (source === undefined) {
          return;
        }
        code = run({
          source: String(source),
          parse: y.parse,
          indent: y.indent,
          compress: y.compress,
          mixinRecursionLimit: y['mixin-recursion-limit']
        }, streams);
      }
    )
    .exitProcess(false)
    .fail((msg) => {
      streams.err.write(`${msg}\n${help}`);
      code = ERR;
    })
    .parse();
  return code;
};
