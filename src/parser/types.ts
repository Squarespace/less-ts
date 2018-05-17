import { whitespace } from '../utils';

export const enum Chars {
  // 0x00
  NULL = '\0',
  // 0x09
  HORIZONTAL_TAB = '\t',
  // 0x0A
  LINE_FEED = '\n',
  // 0x0B
  VERTICAL_TAB = '\u000B',
  // 0x0C
  FORM_FEED = '\f',
  // 0x0D
  CARRIAGE_RETURN = '\r',
  // 0x20
  SPACE = ' ',
  // 0x21
  EXCLAMATION_MARK = '!',
  // 0x22
  QUOTATION_MARK = '"',
  // 0x23
  NUMBER_SIGN = '#',
  // 0x26
  AMPERSAND = '&',
  // 0x27
  APOSTROPHE = '\'',
  // 0x28
  LEFT_PARENTHESIS = '(',
  // 0x29
  RIGHT_PARENTHESIS = ')',
  // 0x2A
  ASTERISK = '*',
  // 0x2B
  PLUS_SIGN = '+',
  // 0x2C
  COMMA = ',',
  // 0x2D
  MINUS_SIGN = '-',
  // 0x2E
  PERIOD = '.',
  // 0x2F
  SLASH = '/',
  // 0x3A
  COLON = ':',
  // 0x3B
  SEMICOLON = ';',
  // 0x3C
  LESS_THAN_SIGN = '<',
  // 0x3D
  EQUALS_SIGN = '=',
  // 0x3E
  GREATER_THAN_SIGN = '>',
  // 0x40
  AT_SIGN = '@',
  // 0x5B
  LEFT_SQUARE_BRACKET = '[',
  // 0x5C
  BACKSLASH = '\\',
  // 0x5D
  RIGHT_SQUARE_BRACKET = ']',
  // 0x5F
  UNDERSCORE = '_',
  // 0x60
  GRAVE_ACCENT = '`',
  // 0x75
  LOWERCASE_LETTER_U = 'u',
  // 0x7B
  LEFT_CURLY_BRACKET = '{',
  // 0x7D
  RIGHT_CURLY_BRACKET = '}',
  // 0x7E
  TILDE = '~',
  // 0xA0
  NO_BREAK_SPACE = '\u00A0'
}

const DIGIT = 0x01;
const LOWERCASE = 0x02;
const UPPERCASE = 0x04;
const KEYWORD_START = 0x08;
const DIMENSION_START = 0x10;
const NONASCII = 0x20;
const NONPRINTABLE = 0x40;
const CALL_START = 0x80;
const COMBINATOR = 0x100;
const SELECTOR_END = 0x200;
const PROPERTY_START = 0x400;
const VARIABLE_START = 0x800;

const classify = (ch: string): number => {
  switch (ch) {
    case'\u0000':
    case'\u0001':
    case'\u0002':
    case'\u0003':
    case'\u0004':
    case'\u0005':
    case'\u0006':
    case'\u0007':
    case'\u0008':
      return NONPRINTABLE;

    case '\u000E':
    case '\u000F':
    case '\u0010':
    case '\u0011':
    case '\u0012':
    case '\u0013':
    case '\u0014':
    case '\u0015':
    case '\u0016':
    case '\u0017':
    case '\u0018':
    case '\u0019':
    case '\u001A':
    case '\u001B':
    case '\u001C':
    case '\u001D':
    case '\u001E':
    case '\u001F':
      return NONPRINTABLE;

    case '%':
      return CALL_START;

    case ')':
      return SELECTOR_END;

    case '*':
      return PROPERTY_START;

    case '+':
      return DIMENSION_START | COMBINATOR;

    case ',':
      return SELECTOR_END;

    case '-':
      return CALL_START | DIMENSION_START | KEYWORD_START | PROPERTY_START;

    case '.':
      return DIMENSION_START;

    case '0':
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
      return DIGIT | DIMENSION_START | PROPERTY_START;

    case ';':
      return SELECTOR_END;

    case '>':
      return COMBINATOR;

    case '@':
      return VARIABLE_START;

    case 'A':
    case 'B':
    case 'C':
    case 'D':
    case 'E':
    case 'F':
      return UPPERCASE | CALL_START | KEYWORD_START;

    case 'G':
    case 'H':
    case 'I':
    case 'J':
    case 'K':
    case 'L':
    case 'M':
    case 'N':
    case 'O':
    case 'P':
    case 'Q':
    case 'R':
    case 'S':
    case 'T':
    case 'U':
    case 'V':
    case 'W':
    case 'X':
    case 'Y':
    case 'Z':
      return UPPERCASE | CALL_START | KEYWORD_START;

    case '_':
      return CALL_START | KEYWORD_START | PROPERTY_START;

    case 'a':
    case 'b':
    case 'c':
    case 'd':
    case 'e':
    case 'f':
      return LOWERCASE | CALL_START | KEYWORD_START | PROPERTY_START;

    case 'g':
    case 'h':
    case 'i':
    case 'j':
    case 'k':
    case 'l':
    case 'm':
    case 'n':
    case 'o':
    case 'p':
    case 'q':
    case 'r':
    case 's':
    case 't':
    case 'u':
    case 'v':
    case 'w':
    case 'x':
    case 'y':
    case 'z':
      return LOWERCASE | CALL_START | KEYWORD_START | PROPERTY_START;

    case '{':
      return SELECTOR_END;

    case '|':
      return COMBINATOR;

    case '}':
      return SELECTOR_END;

    case '~':
      return COMBINATOR;

    default:
      break;
  }
  return (ch >= Chars.NO_BREAK_SPACE) ? NONASCII : 0;
};

const LIMIT = 0x80;
const CHAR_CLASSES: number[] = new Array(LIMIT);

for (let i = 0; i < LIMIT; i++) {
  CHAR_CLASSES[i] = classify(String.fromCharCode(i));
}

const RULE_START = PROPERTY_START | VARIABLE_START;

export const isCallStart = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & CALL_START) !== 0;

export const isCombinator = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & COMBINATOR) !== 0;

export const isDigit = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & DIGIT) !== 0;

export const isDimensionStart = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & DIMENSION_START) !== 0;

export const isKeywordStart = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & KEYWORD_START) !== 0;

export const isNonprintable = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & NONPRINTABLE) !== 0;

export const isPropertyStart = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & PROPERTY_START) !== 0;

export const isRuleStart = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & RULE_START) !== 0;

export const isSelectorEnd = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & SELECTOR_END) !== 0;

export const isSkippable = (ch: string): boolean =>
  ch === ';' || whitespace(ch);

export const isUppercase = (ch: string): boolean =>
  ch !== undefined && (CHAR_CLASSES[ch.charCodeAt(0)] & UPPERCASE) !== 0;
