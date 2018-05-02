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
  let r = s;
  n--;
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
    return c - Chars.DIGIT_a;
  }
  if (c >= Chars.DIGIT_A && c <= Chars.DIGIT_F) {
    return c - Chars.DIGIT_A;
  }
  return 0;
};
