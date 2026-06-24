import { LessError } from './common';

// The reference renders error messages Java-escaped: double quote and
// backslash get backslashed, control characters become short escapes,
// and non-ASCII bytes become \uXXXX. Apply it to the finished message.
export const escapeJava = (raw: string): string => {
  let buf = '';
  const len = raw.length;
  for (let i = 0; i < len; i++) {
    const c = raw[i];
    switch (c) {
      case '"':
        buf += '\\"';
        break;
      case '\\':
        buf += '\\\\';
        break;
      case '\b':
        buf += '\\b';
        break;
      case '\n':
        buf += '\\n';
        break;
      case '\t':
        buf += '\\t';
        break;
      case '\f':
        buf += '\\f';
        break;
      case '\r':
        buf += '\\r';
        break;
      default: {
        const code = raw.charCodeAt(i);
        if (code < 0x20 || code > 0x7f) {
          buf += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          buf += c;
        }
      }
    }
  }
  return buf;
};

const runtimeError = (message: string): LessError => ({ type: 'runtime', message: escapeJava(message) });

export const argCount = (name: string, min: number, count: number): LessError =>
  runtimeError(`ExecuteError ARG_COUNT: Function ${name} requires at least ${min} args, found ${count} `);

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

export const invalidArg = (index: number, type1: string, type2: string): LessError =>
  runtimeError(`ExecuteError INVALID_ARG: Argument ${index} must be ${type1}. Found ${type2}`);

export const invalidArgExt = (index: number, type1: string, type2: string, repr: string): LessError =>
  runtimeError(`ExecuteError INVALID_ARG_EXT: Argument ${index} must be ${type1}. Found ${type2}: ${repr}`);

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
