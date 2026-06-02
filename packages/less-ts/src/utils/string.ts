import { CompatLevel, Patch } from '../compat';

export const whitespace = (ch: string): boolean => {
  return (
    (ch >= '\t' && ch <= '\r') ||
    ch === ' ' ||
    // v8 JavaScript engine's whitespace ranges follow
    ch === '\u00a0' ||
    ch === '\u1680' ||
    ch === '\u180e' ||
    (ch >= '\u2000' && ch <= '\u200a') ||
    (ch >= '\u2028' && ch <= '\u2029') ||
    ch === '\u202f' ||
    ch === '\u205f' ||
    ch === '\u3000' ||
    ch === '\ufeff'
  );
};

export const repeat = (s: string, n: number): string => {
  let r = '';
  while (n-- > 0) {
    r += s;
  }
  return r;
};

const HEX = '0123456789abcdef';

const enum Chars {
  DIGIT_0 = 0x30,
  DIGIT_9 = 0x39,
  DIGIT_a = 0x61,
  DIGIT_f = 0x66,
  DIGIT_A = 0x41,
  DIGIT_F = 0x46,
}

export const hexchar = (v: number): string => HEX[v] || '0';

export const hexvalue = (ch: string): number => {
  const c = ch.codePointAt(0) || Chars.DIGIT_0;
  if (c >= Chars.DIGIT_0 && c <= Chars.DIGIT_9) {
    return c - Chars.DIGIT_0;
  }
  if (c >= Chars.DIGIT_a && c <= Chars.DIGIT_f) {
    return 10 + (c - Chars.DIGIT_a);
  }
  if (c >= Chars.DIGIT_A && c <= Chars.DIGIT_F) {
    return 10 + (c - Chars.DIGIT_A);
  }
  return 0;
};

export const MAX_NUMBER = 1e20;
export const MIN_NUMBER = -1e20;

export const clampNumber = (n: number): number => Math.max(MIN_NUMBER, Math.min(n, MAX_NUMBER));

// Plain decimal string of a double, no exponent notation (matches Java
// BigDecimal toPlainString).
export const toPlainString = (n: number): string => {
  const { sign, digits, point } = decimalParts(n);
  if (point >= digits.length) {
    return sign + digits + '0'.repeat(point - digits.length);
  }
  return sign + digits.slice(0, point) + '.' + digits.slice(point);
};

// Port of Java Double.toString: shortest round-trip digits, plain
// notation for exponents -3 through 6 (1.0, 0.001, 9999999.0),
// scientific outside that range (1.0E-4, 1.0E7), ".0" appended to
// integral values, and a signed exponent only when negative.
// Known deviation: at magnitudes of 1e16 and above the JDK sometimes
// emits one digit beyond the shortest round-trip (observed to 1e19);
// this emits the shortest. Below 1e16 everything matches.
export const javaDouble = (n: number): string => {
  if (Number.isNaN(n)) {
    return 'NaN';
  }
  if (n === Infinity) {
    return 'Infinity';
  }
  if (n === -Infinity) {
    return '-Infinity';
  }
  if (n === 0) {
    return Object.is(n, -0) ? '-0.0' : '0.0';
  }
  // toExponential() gives the shortest round-trip digits with a
  // normalized mantissa: |n| = d1.d2...dk x 10^e, d1 != '0'.
  const sign = n < 0 ? '-' : '';
  const [mant, expPart] = Math.abs(n).toExponential().split('e');
  const e = parseInt(expPart, 10);
  const digits = mant.replace('.', '');
  if (e < -3 || e >= 7) {
    const mantissa = digits.length > 1 ? digits.charAt(0) + '.' + digits.slice(1) : digits + '.0';
    return sign + mantissa + 'E' + e;
  }
  if (e >= 0) {
    const intLen = e + 1;
    if (intLen >= digits.length) {
      return sign + digits + '0'.repeat(intLen - digits.length) + '.0';
    }
    return sign + digits.slice(0, intLen) + '.' + digits.slice(intLen);
  }
  return sign + '0.' + '0'.repeat(-e - 1) + digits;
};

// Port of Java ModelUtils.formatDouble: integral values render as plain
// integers; otherwise the value is rounded half-even to the given scale,
// trailing zeros are stripped, and the leading zero of values in (-1, 1)
// is dropped. The drop applies to the rounded string, so values that
// round to "0" or "1" (e.g. 1e-9, 0.999999999) render as an empty
// string, as Java does.
//
// Non-finite values render as '0' while NONFINITE_AS_ZERO is active (the
// released behavior); at the fixed level the visible text renders:
// NaN, Infinity, -Infinity, the same strings Java Double.toString
// emits.
export const formatDouble = (n: number, scale: number = 8, compat: CompatLevel = CompatLevel.defaultLevel()): string => {
  if (!Number.isFinite(n)) {
    if (compat.enabled(Patch.NONFINITE_AS_ZERO)) {
      return '0';
    }
    return String(n);
  }
  if (n === Math.trunc(n)) {
    // Java appends (long)value: the cast is exact in [-2^63, 2^63), and
    // the value == lval check runs in double precision, so 2^63 matches
    // the saturated Long.MAX_VALUE and renders as that; above 2^63 the
    // BigDecimal path applies.
    if (n >= -9223372036854775808 && n < 9223372036854775808) {
      return exactIntString(n);
    }
    if (n === 9223372036854775808) {
      return '9223372036854775807';
    }
    return toPlainString(n);
  }
  const s = scaledPlainString(n, scale);
  if (n > 0 && n < 1.0) {
    return s.substring(1);
  }
  if (n > -1.0 && n < 0 && s.charAt(0) === '-') {
    return '-' + s.substring(2);
  }
  return s;
};

// BigDecimal.valueOf(n).setScale(scale, HALF_EVEN).stripTrailingZeros()
// .toPlainString(): exact decimal rounding of the shortest round-trip
// representation, no exponent notation.
const scaledPlainString = (n: number, scale: number): string => {
  const { sign, digits, point } = decimalParts(n);
  const intLen = point > 0 ? point : 0;
  let intPart = digits.slice(0, intLen);
  if (intPart.length < intLen) {
    intPart = intPart + '0'.repeat(intLen - intPart.length);
  }
  let frac = (point < 0 ? '0'.repeat(-point) : '') + digits.slice(intLen);

  if (frac.length > scale) {
    const kept = frac.slice(0, scale);
    const rest = frac.slice(scale);
    const lead = rest.charCodeAt(0) - 0x30;
    let roundUp = lead > 5;
    if (lead === 5) {
      let more = false;
      for (let i = 1; i < rest.length; i++) {
        if (rest.charCodeAt(i) !== 0x30) {
          more = true;
          break;
        }
      }
      const last = intPart + kept;
      const lastDigit = last === '' ? 0 : last.charCodeAt(last.length - 1) - 0x30;
      roundUp = more || lastDigit % 2 === 1;
    }
    if (roundUp) {
      const arr = (intPart + kept).split('');
      let i = arr.length - 1;
      while (i >= 0 && arr[i] === '9') {
        arr[i] = '0';
        i--;
      }
      if (i >= 0) {
        arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1);
      } else {
        arr.unshift('1');
      }
      const full = arr.join('');
      intPart = full.slice(0, full.length - kept.length);
      frac = full.slice(full.length - kept.length);
    } else {
      frac = kept;
    }
  }

  frac = frac.replace(/0+$/, '');
  if (intPart === '') {
    intPart = '0';
  }
  // BigDecimal toPlainString drops the sign for zero values.
  if (intPart === '0' && frac === '') {
    return '0';
  }
  return sign + intPart + (frac === '' ? '' : '.' + frac);
};

// Split a double into decimal digits and the point position, using the
// shortest round-trip representation (Java BigDecimal.valueOf does the
// same via Double.toString).
const decimalParts = (n: number): { sign: string; digits: string; point: number } => {
  let s = String(n);
  let sign = '';
  if (s.charAt(0) === '-') {
    sign = '-';
    s = s.slice(1);
  }
  const e = s.indexOf('e');
  const mant = e === -1 ? s : s.slice(0, e);
  const exp = e === -1 ? 0 : parseInt(s.slice(e + 1), 10);
  const dot = mant.indexOf('.');
  const digits = dot === -1 ? mant : mant.slice(0, dot) + mant.slice(dot + 1);
  const point = (dot === -1 ? mant.length : dot) + exp;
  return { sign, digits, point };
};

// Exact decimal value of an integral double. Below 2^53 String(n) is
// exact; between 2^53 and 2^63 the shortest representation can lose low
// bits, so halve into the exact range and double the decimal string back.
const exactIntString = (n: number): string => {
  const sign = n < 0 ? '-' : '';
  let a = Math.abs(n);
  let k = 0;
  while (a >= 9007199254740992) {
    a /= 2;
    k++;
  }
  let s = String(a);
  for (let i = 0; i < k; i++) {
    let carry = 0;
    let out = '';
    for (let j = s.length - 1; j >= 0; j--) {
      const d = (s.charCodeAt(j) - 0x30) * 2 + carry;
      out = String(d % 10) + out;
      carry = d > 9 ? 1 : 0;
    }
    s = carry > 0 ? String(carry) + out : out;
  }
  return sign + s;
};
