export const whitespace = (ch: string): boolean => {
  return (ch >= '\t' && ch <= '\r')
    || (ch === ' ')
    // v8 JavaScript engine's whitespace ranges follow
    || (ch === '\u00a0')
    || (ch === '\u1680')
    || (ch === '\u180e')
    || (ch >= '\u2000' && ch <= '\u200a')
    || (ch >= '\u2028' && ch <= '\u2029')
    || (ch === '\u202f')
    || (ch === '\u205f')
    || (ch === '\u3000')
    || (ch === '\ufeff');
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
  DIGIT_F = 0x46
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

export const clampNumber = (n: number): number =>
  Math.max(MIN_NUMBER, Math.min(n, MAX_NUMBER));

export const formatDouble = (n: number): string => {
  const q = Math.floor(n);
  if (q === n) {
    return clampNumber(n).toString();
  }

  // Emit floating point values without a leading '0' digit.
  const s = n < 0 ? '-' : '';
  const a = clampNumber(Math.abs(n));
  return s + (a < 1 ? a.toString().substring(1) : a);
};
