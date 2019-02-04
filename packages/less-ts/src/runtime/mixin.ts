import { Context, ExecEnv, Node } from '../common';
import { argTooMany, internalError, namedArgNotFound } from '../errors';
import {
  Argument,
  Block,
  Definition,
  Expression,
  GenericBlock,
  MixinCall,
  MixinCallArgs,
  MixinParams,
  Parameter
} from '../model';
import { safeEquals } from '../utils';

const EMPTY_BLOCK = new GenericBlock(new Block());

export class MixinMatcher {

  readonly ctx: Context;
  readonly args: MixinCallArgs;

  constructor(readonly env: ExecEnv, readonly call: MixinCall) {
    this.ctx = env.ctx;
    const { args } = call;
    this.args = args ? args.eval(env) as MixinCallArgs : args;
  }

  /**
   * If the given mixin params pattern matched this call, bind the arguments.
   */
  bind(mixinParams: MixinParams): GenericBlock {
    if (mixinParams.needsEval()) {
      this.env.errors.push(internalError('Serious error: params must already be evaluated!'));
      return EMPTY_BLOCK;
    }

    const { ctx } = this.env;
    const { params } = mixinParams;
    const paramSize = params.length;

    let variadicName: string | undefined;
    let variadic: Expression | undefined;
    const bindings: { [x: string]: Node } = {};
    const names: string[] = [];

    // Bind parameter default values, collect parameter names and prepare
    // a variadic expression if needed.
    for (let i = 0; i < paramSize; i++) {
      const param = params[i];
      const name = param.name;
      if (param.variadic) {
        variadicName = name;
        variadic = new Expression([]);
      } else if (name) {
        names.push(name);
        if (param.value) {
          bindings[name] = param.value;
        }
      }
    }

    // Bind all named arguments.
    const { args } = this.args;
    const argSize = args.length;
    for (let i = 0; i < argSize; i++) {
      const arg = args[i];
      const { name } = arg;
      if (name === undefined) {
        continue;
      }

      // Check if named argument does not correspond to a parameter
      const j = names.indexOf(name);
      if (j === -1) {
        const callName = this.ctx.render(this.call.selector);
        this.env.errors.push(namedArgNotFound(callName, name));
        continue;
      }

      // Bind value and remove name from list
      bindings[name] = arg.value;
      names.splice(j, 1);
    }

    // Bind all remaining positional arguments.
    for (let i = 0; i < argSize; i++) {
      const arg = args[i];
      const name = arg.name;
      if (name) {
        continue;
      }

      // Do we have a valid positional parameter? Check for variadic or a
      // value pattern match.
      if (i < paramSize) {
        const param = params[i];
        if (param.variadic && variadic) {
          variadic.add(arg.value);
          continue;
        } else if (!param.name) {
          // Pattern match
          continue;
        }
      }

      // Positional argument, assign to one of the remaining named arguments, if any.
      if (names.length > 0) {
        const n = names.shift();
        if (n) {
          bindings[n] = arg.value;
        }
      } else if (variadic !== undefined) {
        variadic.add(arg.value);
      } else {
        // No names left and no variadic exists to collect the overflow.
        // We should never reach this point since the pattern match would
        // also have failed.
        const callName = this.ctx.render(this.call.selector);
        this.env.errors.push(argTooMany(callName));
        continue;
      }
    }

    // Build the final argument -> params bindings
    const _arguments = new Expression([]);
    const block = new Block([]);
    for (const key of Object.keys(bindings)) {
      const value = bindings[key];
      block.add(new Definition(key, value));
      _arguments.add(value);
    }
    if (variadicName && variadic) {
      block.add(new Definition(variadicName, variadic));
    }
    if (variadic) {
      for (const value of variadic.values) {
        _arguments.add(value);
      }
    }
    block.add(new Definition('@arguments', _arguments));
    return new GenericBlock(block);
  }

  /**
   * Attempt to pattern match the params against the arguments.
   */
  patternMatch(mixinParams: MixinParams): boolean {
    const args = this.args ? this.args.args : undefined;
    const argSize = args ? args.length : 0;
    if (argSize < mixinParams.required) {
      return false;
    }
    const { params } = mixinParams;
    const paramSize = params.length;
    if (!mixinParams.variadic && argSize > paramSize) {
      return false;
    }

    if (!args) {
      return true;
    }

    const size = Math.min(argSize, paramSize);
    for (let i = 0; i < size; i++) {
      const arg = args[i];
      const param = params[i];
      if (!param.name && !param.variadic && !this.valueEquals(arg, param)) {
        return false;
      }
    }
    return true;
  }

  private valueEquals(arg: Argument, param: Parameter): boolean {
    const val1 = arg.value;
    const val2 = param.value;
    if (!safeEquals(val1, val2)) {
      const str1 =  this.ctx.render(val1);
      const str2 = val2 === undefined ? '' : this.ctx.render(val2);
      if (str1 !== str2) {
        return false;
      }
    }
    return true;
  }

}
