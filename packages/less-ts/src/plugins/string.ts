import { ExecEnv, Function, Node, NodeType } from '../common';
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

const asString = (env: ExecEnv, node: Node, escape: boolean): string => {
  if (escape && (node.type === NodeType.QUOTED)) {
    const str = (node as Quoted).copy();
    str.escaped = true;
    node = str;
  }
  return env.ctx.render(node);
 };

export const STRING: { [x: string]: Function } = {
  e: new EFunc(),
  escape: new Escape(),
  '%': new Format()
};
