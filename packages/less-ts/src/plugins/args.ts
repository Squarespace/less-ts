import { ExecEnv, LessError, Node, NodeType } from '../common';
import { argCount, argCountIgnore, invalidArg } from '../errors';
import { Dimension, Unit } from '../model';

export class ArgSpec {

  readonly validators: ArgValidator[] = [];
  readonly minArgs: number;
  readonly variadic: boolean;

  constructor(readonly name: string, spec: string) {
    const v: ArgValidator[] = [];
    let minArgs: number = -1;
    let variadic: boolean = false;
    const len = spec.length;
    for (let i = 0; i < len; i++) {
      const c = spec[i];
      switch (c) {
        case '*':
          v.push(ARG_ANY);
          break;
        case ':':
          minArgs = i;
          break;
        case '.':
          minArgs = i;
          variadic = true;
          break;
        case 'c':
          v.push(ARG_COLOR);
          break;
        case 'd':
          v.push(ARG_DIMENSION);
          break;
        case 'k':
          v.push(ARG_KEYWORD);
          break;
        case 'n':
          v.push(ARG_NUMBER);
          break;
        case 'p':
          v.push(ARG_PERCENTAGE);
          break;
        case 's':
          v.push(ARG_QUOTED);
          break;
      }
    }

    this.validators = v;
    this.minArgs = minArgs === -1 ? len : minArgs;
    this.variadic = variadic;
  }

  /**
   * Validate the arguments are of the expected type.
   */
  validate(env: ExecEnv, args: Node[]): [boolean, LessError[]] {
    const errors: LessError[] = [];
    const { ctx } = env;
    let len = args.length;
    if (len < this.minArgs) {
      // not enough arguments to call the function
      errors.push(argCount(this.name, this.minArgs, len));
      return [false, errors];

    } else if (this.variadic || len > this.validators.length) {
      // Extra args were provided but we will ignore them
      errors.push(argCountIgnore(this.name, this.minArgs, len));
      len = this.validators.length;
    }

    for (let i = 0; i < len; i++) {
      const v = this.validators[i];
      // If an argument fails to validate, we can't call the function, so bail out
      if (!v.validate(args[i])) {
        errors.push(invalidArg(this.name, i + 1, v.type, ctx.render(args[i])));
        return [false, errors];
      }
    }
    return [true, errors];
  }
}

// export type ArgValidator = (arg: Node) => boolean;

export interface ArgValidator {
  type: string;
  validate(arg: Node): boolean;
}

export const ARG_ANY: ArgValidator = {
  type: 'any',
  validate: (arg: Node): boolean => true
};

export const ARG_COLOR: ArgValidator = {
  type: 'color',
  validate: (arg: Node): boolean => arg.type === NodeType.COLOR
};

export const ARG_DIMENSION: ArgValidator = {
  type: 'dimension',
  validate: (arg: Node): boolean => arg.type === NodeType.DIMENSION
};

export const ARG_KEYWORD: ArgValidator = {
  type: 'keyword',
  validate: (arg: Node): boolean => arg.type === NodeType.KEYWORD
};

export const ARG_NUMBER: ArgValidator = {
  type: 'number',
  validate: (arg: Node): boolean => {
    if (arg.type === NodeType.DIMENSION) {
      if ((arg as Dimension).unit === undefined) {
        return true;
      }
    }
    return false;
  }
};

export const ARG_PERCENTAGE: ArgValidator = {
  type: 'percentage',
  validate: (arg: Node): boolean => {
    if (arg.type === NodeType.DIMENSION) {
      const unit = (arg as Dimension).unit;
      if (unit === undefined || unit === Unit.PERCENTAGE) {
        return true;
      }
    }
    return false;
  }
};

export const ARG_QUOTED: ArgValidator = {
  type: 'quoted',
  validate: (arg: Node): boolean => arg.type === NodeType.QUOTED
};
