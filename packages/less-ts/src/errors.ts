import { LessError } from './common';

const runtimeError = (message: string): LessError => ({ type: 'runtime', message });

export const argCount = (name: string, min: number, count: number): LessError =>
  runtimeError(`Function ${name} requires at least ${min} args, found ${count}`);

export const argTooMany = (call: string): LessError => runtimeError(`Too many arguments provided to mixin call ${call}`);

export const divideByZero = (arg: string): LessError =>
  runtimeError(`ExecuteError DIVIDE_BY_ZERO: Attempt to divide ${arg} by zero.`);

export const expectedBoolOp = (operator: string): LessError =>
  runtimeError(`Expected a boolean operator in expression, got ${operator}`);

export const expectedMathOp = (op: string): LessError => runtimeError(`Expected math operator, got ${op}`);

export const formatFunctionArgs = (expected: number, actual: number): LessError =>
  runtimeError(`Not enough args for format string. Format function expects ` + `${expected} but only found ${actual}`);

export const incompatibleUnits = (from: string, to: string): LessError =>
  runtimeError(`ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from ${from} to ${to}`);

// Strict-mode rejection of color math. The verb is the Java phrasing:
// "be subtracted from" for -, "divide" for /.
export const badColorMath = (verb: string, dim: string): LessError =>
  runtimeError(`ExecuteError BAD_COLOR_MATH: A color cannot ${verb} ${dim}`);

// Operation fails with both operand types (the Node.operate default),
// e.g. a function call used as an operand.
export const invalidOperation = (op: string, left: string, right: string): LessError =>
  runtimeError(`ExecuteError INVALID_OPERATION2: Operation ${op} cannot be applied to ${left} and ${right}`);

// Operation fails with the single left operand type (Dimension.operate
// and BaseColor.operate).
export const invalidOperation1 = (op: string, type: string): LessError =>
  runtimeError(`ExecuteError INVALID_OPERATION1: Operation ${op} cannot be applied to ${type}`);

export const invalidArg = (name: string, index: number, type1: string, type2: string): LessError =>
  runtimeError(`Function ${name} arg ${index} must be ${type1}, found ${type2}`);

// The color() builtin rejects a string that is not a 3/6-digit hex color.
export const invalidColor = (repr: string): LessError =>
  runtimeError(`ExecuteError INVALID_COLOR: Invalid color string ${repr}, expected 3 or 6 hex characters`);

export const internalError = (message: string): LessError => runtimeError(message);

export const mixinRecurse = (path: string, limit: number): LessError =>
  runtimeError(`Mixin call ${path} exceeded the recursion limit of ${limit}`);

export const mixinUndefined = (path: string): LessError =>
  runtimeError(`ExecuteError MIXIN_UNDEFINED: Failed to locate a mixin using selector ${path}`);

export const namedArgNotFound = (name: string): LessError =>
  runtimeError(`ExecuteError ARG_NAMED_NOTFOUND: Named arg ${name} not found`);

export const uncomparableType = (type: string): LessError =>
  runtimeError(`ExecuteError UNCOMPARABLE_TYPE: Unable to compare instances of ${type}`);

export const unknownUnit = (repr: string): LessError =>
  runtimeError(`ExecuteError UNKNOWN_UNIT: Unknown unit ${repr}`);

export const varCircularRef = (name: string): LessError => runtimeError(`Variable ${name} references itself`);

export const varUndefined = (name: string): LessError =>
  runtimeError(`ExecuteError VAR_UNDEFINED: Failed to locate a definition for the variable ${name} in current scope`);
