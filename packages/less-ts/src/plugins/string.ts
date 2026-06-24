import { ExecEnv, Function, Node, NodeType } from '../common';
import { Patch } from '../compat';
import { formatFunctionArgs } from '../errors';
import { Anonymous, BaseColor, Quoted } from '../model';
import { BaseFunction } from './base';

class EFunc extends BaseFunction {
  constructor() {
    super('e', 's');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const str = args[0] as Quoted;
    const res = new Quoted(str.delim, true, str.parts);
    return new Anonymous(env.ctx.render(res));
  }
}

class Escape extends BaseFunction {
  constructor() {
    super('escape', 's');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const str = asString(env, args[0], true);
    return new Anonymous(escape(str));
  }
}

class Format extends BaseFunction {
  constructor() {
    super('%', 's.');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const orig = args[0] as Quoted;
    const format = asString(env, orig, true);

    const len = format.length;
    let buf = '';

    let i = 0;
    let j = 1;
    let formatters = 0;
    let error = false;

    while (i < len) {
      let ch = format[i];
      if (ch !== '%') {
        buf += ch;
        i++;
        continue;
      }

      i++;
      if (i === len) {
        buf += '%';
        break;
      }

      ch = format[i];
      if (ch === '%') {
        buf += '%';
        i++;
        continue;
      }

      // Only s/S/d/D/a/A are real format specifiers. Any other "%X"
      // passes through literally, without consuming an argument.
      if ('sSdDaA'.indexOf(ch) === -1) {
        buf += '%' + ch;
        i++;
        continue;
      }

      formatters++;
      if (j >= args.length) {
        i++;
        error = true;
        continue;
      }

      let arg = args[j];
      if (arg.type === NodeType.COLOR) {
        const color = (arg as BaseColor).toRGB().copy();
        color.forceHex = true;
        arg = color;
      }

      const escape = ch === 's' || ch === 'S';
      let value = asString(env, arg, escape);
      if ('ADS'.indexOf(ch) !== -1) {
        value = encodeURIComponent(value);
      }
      buf += value;
      i++;
      j++;
    }
    if (error) {
      env.errors.push(formatFunctionArgs(formatters, args.length - 1));
    }
    return new Quoted(orig.delim, orig.escaped, [new Anonymous(buf)]);
  }
}

class Replace extends BaseFunction {
  constructor() {
    super('replace', '*s*:s');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    env.addWarning('use of replace() is currently experimental');
    const stringArg = args[0] as Quoted;
    const string = asString(env, stringArg, true);
    const pattern = asString(env, args[1] as Quoted, true);
    // REPLACE_REGEX_GROUPS: legacy treats $n in the replacement as
    // regex group references. Fixed levels escape the dollars so the
    // replacement inserts literally.
    let replacement = asString(env, args[2] as Quoted, true);
    if (!env.ctx.compat.enabled(Patch.REPLACE_REGEX_GROUPS)) {
      replacement = replacement.replace(/\$/g, '$$$$');
    }
    const output = new Anonymous(string.replace(new RegExp(pattern, 'g'), replacement));
    return new Quoted(stringArg.delim, stringArg.escaped, [output]);
  }
}

const asString = (env: ExecEnv, node: Node, escape: boolean): string => {
  if (escape && node.type === NodeType.QUOTED) {
    const str = (node as Quoted).copy();
    str.escaped = true;
    node = str;
  }
  return env.ctx.render(node);
};

export const STRING: { [x: string]: Function } = {
  e: new EFunc(),
  escape: new Escape(),
  '%': new Format(),
};

// replace() is not in the reference's default function table (it is an
// extension, registered only by consumers that opt in), so it is not in
// the dispatch table. The class stays exported for the ext-surface tests
// and for a consumer that registers it.
export const REPLACE: Function = new Replace();
