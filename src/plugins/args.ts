import { Node, NodeType } from '../common';
import { BaseColor, Dimension, Unit } from '../model';

export class ArgSpec {

  readonly validators: ArgValidator[] = [];
  readonly minArgs: number;
  readonly variadic: boolean;

  constructor(spec: string) {
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
  validate(args: Node[]): boolean {
    let len = args.length;
    if (len < this.minArgs) {
      return false;
    } else if (this.variadic || len > this.validators.length) {
      len = this.validators.length;
    }
    for (let i = 0; i < len; i++) {
      if (!this.validators[i](args[i])) {
        return false;
      }
    }
    return true;
  }
}

export type ArgValidator = (arg: Node) => boolean;

export const ARG_ANY: ArgValidator = (arg: Node): boolean => true;

export const ARG_COLOR: ArgValidator = (arg: Node): boolean =>
  arg.type === NodeType.COLOR;

export const ARG_DIMENSION: ArgValidator = (arg: Node): boolean =>
  arg.type === NodeType.DIMENSION;

export const ARG_KEYWORD: ArgValidator = (arg: Node): boolean =>
  arg.type === NodeType.KEYWORD;

export const ARG_NUMBER: ArgValidator = (arg: Node): boolean => {
  if (arg.type === NodeType.DIMENSION) {
    if ((arg as Dimension).unit === undefined) {
      return true;
    }
  }
  return false;
};

export const ARG_PERCENTAGE: ArgValidator = (arg: Node): boolean => {
  if (arg.type === NodeType.DIMENSION) {
    const unit = (arg as Dimension).unit;
    if (unit === undefined || unit === Unit.PERCENTAGE) {
      return true;
    }
  }
  return false;
};

export const ARG_QUOTED: ArgValidator = (arg: Node): boolean =>
  arg.type === NodeType.COLOR;
