import { LessError } from './common';

const runtimeError = (message: string): LessError =>
  ({ type: 'runtime', message });

export const argCount = (name: string, min: number, count: number): LessError =>
  runtimeError(`Function ${name} requires at least ${min} args, found ${count}`);

export const argCountIgnore = (name: string, min: number, count: number): LessError =>
  runtimeError(`Function ${name} requires at least ${min} args, found ${count}` +
    '.. ignoring additional args');

export const argTooMany = (call: string): LessError =>
  runtimeError(`Too many arguments provided to mixin call ${call}`);

export const divideByZero = (arg: string): LessError =>
  runtimeError(`Attempt to divide ${arg} by zero`);

export const expectedBoolOp = (operator: string): LessError =>
  runtimeError(`Expected a boolean operator in expression, got ${operator}`);

export const expectedMathOp = (op: string): LessError =>
  runtimeError(`Expected math operator, got ${op}`);

export const formatFunctionArgs = (expected: number, actual: number): LessError =>
  runtimeError(`Not enough args for format string. Format function expects ` +
  `${expected} but only found ${actual}`);

export const incompatibleUnits = (unit: string, type: string): LessError =>
  runtimeError(`No conversion is possible from ${unit} to ${type}, stripping unit`);

export const invalidOperation = (op: string, left: string, right: string): LessError =>
  runtimeError(`Operation ${op} cannot be applied to ${left} and ${right}`);

export const invalidArg = (name: string, index: number, type1: string, type2: string): LessError =>
  runtimeError(`Function ${name} arg ${index} must be ${type1}, found ${type2}`);

export const internalError = (message: string): LessError =>
  runtimeError(message);

export const mixinRecurse = (path: string, limit: number): LessError =>
  runtimeError(`Mixin call ${path} exceeded the recursion limit of ${limit}`);

export const mixinUndefined = (path: string): LessError =>
  runtimeError(`Failed to locate a mixin using selector ${path}`);

export const namedArgNotFound = (call: string, name: string): LessError =>
  runtimeError(`Binding params for mixin call ${call}, named arg ${name} not found`);

export const uncomparableType = (type: string): LessError =>
  runtimeError(`Unable to compare instances of ${type}`);

export const unknownUnit = (repr: string): LessError =>
  runtimeError(`Unknown unit "${repr}"`);

export const varCircularRef = (name: string): LessError =>
  runtimeError(`Variable ${name} references itself`);

export const varUndefined = (name: string): LessError =>
  runtimeError(`Failed to locate a definition for the variable ${name} in current scope`);
