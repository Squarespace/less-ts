import { ExecEnv, LessError, Node, NodeName, NodeType } from '../common';
import { argCount, invalidArg, invalidArgExt } from '../errors';
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
        case 'h':
          v.push(ARG_HUE);
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
   * Validate the arguments are of the expected type. The error text is
   * the reference's: type positions report INVALID_ARG_EXT with the
   * argument's rendered repr, the number positions report INVALID_ARG.
   */
  validate(env: ExecEnv, args: Node[]): [boolean, LessError[]] {
    const errors: LessError[] = [];
    let len = args.length;
    if (len < this.minArgs) {
      // not enough arguments to call the function
      errors.push(argCount(this.name, this.minArgs, len));
      return [false, errors];
    } else if (len > this.validators.length) {
      if (this.variadic) {
        // Variadic functions absorb the extras; only the declared
        // positions are validated.
        len = this.validators.length;
      } else {
        // Extra args to a fixed-arity function fail the call.
        errors.push(argCount(this.name, this.minArgs, len));
        return [false, errors];
      }
    }

    for (let i = 0; i < len; i++) {
      // If an argument fails to validate, we can't call the function, so bail out
      const error = this.validators[i].validate(i, args[i], env);
      if (error !== undefined) {
        errors.push(error);
        return [false, errors];
      }
    }
    return [true, errors];
  }
}

// A position validator reports the first invalid argument as a Less
// error (the reference's wording) or undefined when the argument is
// accepted.
export interface ArgValidator {
  validate(index: number, arg: Node, env: ExecEnv): LessError | undefined;
}

const typeValidator = (type: NodeType): ArgValidator => ({
  validate: (index: number, arg: Node, env: ExecEnv): LessError | undefined =>
    arg.type === type ? undefined : invalidArgExt(index + 1, NodeName[type], NodeName[arg.type], env.ctx.render(arg)),
});

const ARG_COLOR: ArgValidator = typeValidator(NodeType.COLOR);
const ARG_DIMENSION: ArgValidator = typeValidator(NodeType.DIMENSION);
const ARG_KEYWORD: ArgValidator = typeValidator(NodeType.KEYWORD);
const ARG_QUOTED: ArgValidator = typeValidator(NodeType.QUOTED);
const ARG_ANY: ArgValidator = {
  validate: (): undefined => undefined,
};

const ARG_NUMBER: ArgValidator = {
  validate: (index: number, arg: Node): LessError | undefined => {
    if (arg.type !== NodeType.DIMENSION) {
      return invalidArg(index + 1, 'DIMENSION', NodeName[arg.type]);
    }
    if ((arg as Dimension).unit === undefined) {
      return undefined;
    }
    // The reference reports this position 0-based.
    return invalidArg(index, 'a unit-less number', NodeName[arg.type]);
  },
};

// Any number, with units or not: hue angles take deg/rad/grad/turn.
const ARG_HUE: ArgValidator = {
  validate: (index: number, arg: Node): LessError | undefined =>
    arg.type === NodeType.DIMENSION ? undefined : invalidArg(index + 1, 'DIMENSION', NodeName[arg.type]),
};

const ARG_PERCENTAGE: ArgValidator = {
  validate: (index: number, arg: Node): LessError | undefined => {
    if (arg.type !== NodeType.DIMENSION) {
      return invalidArg(index + 1, 'DIMENSION', NodeName[arg.type]);
    }
    const unit = (arg as Dimension).unit;
    if (unit === undefined || unit === Unit.PERCENTAGE) {
      return undefined;
    }
    return invalidArg(index + 1, 'a unit-less number or a percentage', NodeName[arg.type]);
  },
};
