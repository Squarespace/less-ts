import { Context, Node } from '../common';
import { repeat, whitespace } from '../utils';
import { isSkippable } from './types';
import { UNITS } from '../model';

/**
 * Parses a fragment of the LESS syntax.
 */
export interface Parselet {
  parse(stm: LessStream): Node | undefined;
}

export type Mark = [number, number, number, number];

export const enum StreamFlags {
  OPENSPACE
}

const { min, max } = Math;

// Holds forward references for parselets
export class Parselets {
  static ALPHA: Parselet[];
  static ALPHA_SUB: Parselet[];
  static BLOCK: Parselet[];
  static COMMENT: Parselet[];
  static CONDITION: Parselet[];
  static CONDITION_SUB: Parselet[];
  static DIRECTIVE_IMPORT: Parselet[];
  static ELEMENT: Parselet[];
  static ELEMENT_SUB: Parselet[];
  static ENTITY: Parselet[];
  static EXPRESSION: Parselet[];
  static EXPRESSION_LIST: Parselet[];
  static EXPRESSION_SUB: Parselet[];
  static FEATURE: Parselet[];
  static FEATURES: Parselet[];
  static FONT: Parselet[];
  static FONT_SUB: Parselet[];
  static FUNCTION_CALL_ARGS: Parselet[];
  static FUNCTION_CALL_SUB: Parselet[];
  static GUARD: Parselet[];
  static KEYWORD: Parselet[];
  static MIXIN_CALL_ARGS: Parselet[];
  static MIXIN_PARAMETER: Parselet[];
  static MIXIN_PARAMS: Parselet[];
  static MULTIPLICATION: Parselet[];
  static OPERAND: Parselet[];
  static OPERAND_SUB: Parselet[];
  static PRIMARY: Parselet[];
  static PRIMARY_SUB: Parselet[];
  static PROPERTY: Parselet[];
  static QUOTED: Parselet[];
  static RULE: Parselet[];
  static RULESET: Parselet[];
  static RULE_KEY: Parselet[];
  static SELECTOR: Parselet[];
  static SELECTORS: Parselet[];
  static VARIABLE: Parselet[];
  static VARIABLE_CURLY: Parselet[];
}

const enum Patterns {
  AND = 'and',
  ANON_RULE_VALUE = '(?:[^;@+/\'"*`({}-]*);',
  ATTRIBUTE_KEY = '([\\w-]|\\\\.)+',
  ATTRIBUTE_OP = '[|~*$^]?=',
  BOOL_OPERATOR = '<>|=[<>]*|[<>]=*|!=',
  CALL_NAME = '([\\w-_]+|%|progid:[\\w\\.]+)\\(',
  DIMENSION_VALUE = '[+-]?\\d*\\.?\\d+',
  DIRECTIVE = '@[a-z-]+',
  ELEMENT0 = '(?:\\d+\\.\\d+|\\d+)%',
  ELEMENT1 = '(?:[.#]?|:*)(?:[\\w-]|[^\\u0000-\\u009f]|\\\\(?:[A-Fa-f0-9]{1,6} ?|[^A-Fa-f0-9]))+',
  ELEMENT2 = '\\([^)(@]+\\)',
  ELEMENT3 = '[\\.#](?=@)',
  HEXCOLOR = '#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})',
  IDENTIFIER = '[\\w][\\w-]*',
  IMPORTANT = '! *important',
  KEYWORD = '[_A-Za-z-][\\w-]*',
  MIXIN_NAME = '[#.](?:[\\w-]|\\\\(?:[A-Fa-f0-9]{1,6} ?|[^A-Fa-f0-9]))+',
  NOT = 'not',
  OPACITY = 'opacity=',
  PROPERTY = '\\*?-?[_a-z0-9-]+',
  RATIO = '\\d+\\/\\d+',
  SHORTHAND = '[@\\w.%-]+\\/[@\\w.-]+',
  UNICODE_RANGE = 'U\\+[A-Fa-f0-9?]+(\\-[A-Fa-f0-9?]+)?',
  WHEN = 'when',
  WORD = '\\w+'
}

const compile = (s: string, caseInsensitive: boolean = false): RegExp =>
  new RegExp(s, caseInsensitive ? 'iy' : 'y');

export class LessStream {

  index: number = 0;
  flags: number = 0;
  furthest: number = 0;

  readonly length: number;

  private _token: string = '';

  private lineOffset: number = 0;
  private charOffset: number = 0;
  private position: Mark = [0, 0, 0, 0];

  private matchEnd: number = 0;

  private readonly and: RegExp = compile(Patterns.AND);
  private readonly anonRuleValue: RegExp = compile(Patterns.ANON_RULE_VALUE);
  private readonly attributeKey: RegExp = compile(Patterns.ATTRIBUTE_KEY);
  private readonly attributeOp: RegExp = compile(Patterns.ATTRIBUTE_OP);
  private readonly boolOperator: RegExp = compile(Patterns.BOOL_OPERATOR);
  private readonly callName: RegExp = compile(Patterns.CALL_NAME);
  private readonly dimensionUnit: RegExp = compile(UNITS.join('|'), true);
  private readonly dimensionValue: RegExp = compile(Patterns.DIMENSION_VALUE);
  private readonly directive: RegExp = compile(Patterns.DIRECTIVE);
  private readonly element0: RegExp = compile(Patterns.ELEMENT0);
  private readonly element1: RegExp = compile(Patterns.ELEMENT1);
  private readonly element2: RegExp = compile(Patterns.ELEMENT2);
  private readonly element3: RegExp = compile(Patterns.ELEMENT3);
  private readonly hexcolor: RegExp = compile(Patterns.HEXCOLOR);
  private readonly identifier: RegExp = compile(Patterns.IDENTIFIER, true);
  private readonly important: RegExp = compile(Patterns.IMPORTANT);
  private readonly keyword: RegExp = compile(Patterns.KEYWORD);
  private readonly opacity: RegExp = compile(Patterns.OPACITY, true);
  private readonly mixinName: RegExp = compile(Patterns.MIXIN_NAME);
  private readonly not: RegExp = compile(Patterns.NOT);
  private readonly property: RegExp = compile(Patterns.PROPERTY);
  private readonly ratio: RegExp = compile(Patterns.RATIO);
  private readonly shorthand: RegExp = compile(Patterns.SHORTHAND);
  private readonly unicodeRange: RegExp = compile(Patterns.UNICODE_RANGE);
  private readonly when: RegExp = compile(Patterns.WHEN);
  private readonly word: RegExp = compile(Patterns.WORD);

  constructor(readonly ctx: Context, readonly source: string) {
    this.length = source.length;
  }

  /**
   * Skip whitespace and try each parselet until one succeeds
   */
  parse(parselets: Parselet[]): Node | undefined {
    let result: Node | undefined;
    this.skipWs();
    for (const parselet of parselets) {
      result = parselet.parse(this);
      if (result !== undefined) {
        break;
      }
    }
    return result;
  }

  token(): string {
    const r = this._token;
    this._token = '';
    return r;
  }

  matchAnd(): boolean {
    return this.finish(this.test(this.and, this.index));
  }

  matchAnonRuleValue(): boolean {
    if (!this.test(this.anonRuleValue, this.index)) {
      return false;
    }
    this.matchEnd--;
    this.finish(true);
    return true;
  }

  matchAttributeKey(): boolean {
    return this.finish(this.test(this.attributeKey, this.index));
  }

  matchAttributeOp(): boolean {
    return this.finish(this.test(this.attributeOp, this.index));
  }

  matchBoolOperator(): boolean {
    return this.finish(this.test(this.boolOperator, this.index));
  }

  matchCallName(): boolean {
    if (!this.test(this.callName, this.index)) {
      return false;
    }
    this.matchEnd--; // back up from paren
    this.finish(true);
    this.index++; // skip paren
    return true;
  }

  matchDimensionUnit(): boolean {
    return this.finish(this.test(this.dimensionUnit, this.index));
  }

  matchDimensionValue(): boolean {
    return this.finish(this.test(this.dimensionValue, this.index));
  }

  matchDirective(): boolean {
    return this.finish(this.test(this.directive, this.index));
  }

  matchElement0(): boolean {
    return this.finish(this.test(this.element0, this.index));
  }

  matchElement1(): boolean {
    return this.finish(this.test(this.element1, this.index));
  }

  matchElement2(): boolean {
    return this.finish(this.test(this.element2, this.index));
  }

  matchElement3(): boolean {
    return this.finish(this.test(this.element3, this.index));
  }

  matchHexColor(): boolean {
    return this.finish(this.test(this.hexcolor, this.index));
  }

  matchIdentifier(): boolean {
    return this.finish(this.test(this.identifier, this.index));
  }

  matchImportant(): boolean {
    return this.finish(this.test(this.important, this.index));
  }

  matchKeyword(): boolean {
    return this.finish(this.test(this.keyword, this.index));
  }

  matchMixinName(): boolean {
    return this.finish(this.test(this.mixinName, this.index));
  }

  matchNot(): boolean {
    return this.finish(this.test(this.not, this.index));
  }

  matchOpacity(): boolean {
    return this.finish(this.test(this.opacity, this.index));
  }

  matchProperty(): boolean {
    return this.finish(this.test(this.property, this.index));
  }

  matchRatio(): boolean {
    return this.finish(this.test(this.ratio, this.index));
  }

  matchUnicodeRange(): boolean {
    return this.finish(this.test(this.unicodeRange, this.index));
  }

  matchWhen(): boolean {
    return this.finish(this.test(this.when, this.index));
  }

  matchWord(): boolean {
    return this.finish(this.test(this.word, this.index));
  }

  peekShorthand(): boolean {
    return this.test(this.shorthand, this.index);
  }

  checkComplete(): void {
    this.skipWs();
    if (this.peek() !== undefined) {
      // TODO: finish error formatting
      // const limit = min(this.length, 80);
      // const rest = this.source.substring(this.furthest, limit);
      throw new Error(parseError(this.source, this.furthest));
      // throw new Error('incomplete parse:\n' + rest);
    }
  }

  skipWs(): number {
    const start = this.index;
    let i = this.index;
    while (i < this.length) {
      const ch = this.source[i];
      if (!whitespace(ch)) {
        break;
      }
      i++;
    }
    this.index = i;
    return i - start;
  }

  skipEmpty(): number {
    const start = this.index;
    let i = start;
    while (i < this.length) {
      const ch = this.source[i];
      if (!isSkippable(ch)) {
        break;
      }
      this.consume(ch);
      i++;
    }
    this.index = i;
    return i - start;
  }

  peek(): string {
    return this.source[this.index];
  }

  peekn(offset: number): string {
    return this.source[this.index + offset];
  }

  inOpenSpace(): boolean {
    return (this.flags & StreamFlags.OPENSPACE) !== 0;
  }

  seekOpenSpace(): void {
    this.seek1();
    this.flags |= StreamFlags.OPENSPACE;
  }

  setOpenSpace(): void {
    this.flags |= StreamFlags.OPENSPACE;
  }

  seekIf(ch: string): boolean {
    if (this.peek() === ch) {
      this.seek1();
      return true;
    }
    return false;
  }

  seek1(): string {
    const ch = this.source[this.index];
    if (ch !== undefined) {
      this.index++;
      this.consume(ch);
    }
    this.furthest = max(this.index, this.furthest);
    return ch;
  }

  seekn(offset: number): string {
    const limit = Math.min(this.length, this.index + offset);
    while (this.index < limit) {
      this.consume(this.source[this.index]);
      this.index++;
    }
    this.furthest = max(this.index, this.furthest);
    return this.source[this.index];
  }

  seekPast(pattern: string): boolean {
    const i = this.source.indexOf(pattern, this.index);
    if (i !== -1) {
      this.seekn((i + pattern.length) - this.index);
      return true;
    }
    return false;
  }

  mark(m?: Mark): Mark {
    if (m === undefined) {
      m = [0, 0, 0, 0];
    }
    return this._mark(m);
  }

  restore(mark: Mark): void {
    this.index = mark[0];
    this.lineOffset = mark[1];
    this.charOffset = mark[2];
    this.flags = mark[3];
  }

  private consume(ch: string): void {
    this.flags &= ~StreamFlags.OPENSPACE;
  }

  private _mark(mark: Mark): Mark {
    mark[0] = this.index;
    mark[1] = this.lineOffset;
    mark[2] = this.charOffset;
    mark[3] = this.flags;
    return mark;
  }

  private finish(result: boolean): boolean {
    if (result) {
      this._token = this.source.substring(this.index, this.matchEnd);
      this.seekn(this.matchEnd - this.index);
      return true;
    }
    return false;
  }

  private consumeMatch(): void {
    this.seekn(this.matchEnd - this.index);
  }

  private test(pattern: RegExp, start: number): boolean {
    pattern.lastIndex = start;
    if (pattern.test(this.source)) {
      this.matchEnd = pattern.lastIndex;
      return true;
    }
    return false;
  }

}

const WINDOW_SIZE = 74;

/**
 * Construct a parse error.
 */
export const parseError = (source: string, index: number): string => {
  let buf = '';
  buf += 'Line   Statement\n';
  buf += '----   ---------\n';

  const offsets: [number, number][] = [];
  let charPos = 0;
  let i = 0;
  while (i < source.length) {
    const start = i;
    charPos = index - start;
    i = source.indexOf('\n', i);
    if (i === -1) {
      i = source.length;
    }
    i++;
    offsets.push([start, i]);
    if (i > index) {
      break;
    }
  }

  const size = offsets.length;
  for (i = max(0, size - 5); i < size; i++) {
    const pos = offsets[i];
    buf += position(i + 1, 4);

    if (i + 1 === size) {
      const len = pos[1] - pos[0];
      if (len > WINDOW_SIZE) {
        const errpos = pos[0] + charPos;
        const skip = Math.floor(WINDOW_SIZE / 2.0);
        const leftpos = max(errpos - skip, pos[0]);
        charPos -= leftpos - pos[0] - 4;
        buf += '... ';
        buf += source.substring(leftpos, min(leftpos + WINDOW_SIZE, pos[1]));
      } else {
        buf += source.substring(pos[0], pos[1]);
      }
    } else {
      buf += compressString(source.substring(pos[0], pos[1]));
    }
  }
  if (buf[buf.length - 1] !== '\n') {
    buf += '\n';
  }
  buf += repeat(' ', 7);
  buf += repeat('.', charPos);
  buf += '^\n\n';
  buf += 'SyntaxError: INCOMPLETE_PARSE Unable to complete parse.\n';
  return buf;
};

const position = (line: number, colWidth: number): string => {
  const pos = line.toString();
  const w = colWidth - pos.length;
  let buf = '';
  for (let i = 0; i < w; i++) {
    buf += ' ';
  }
  buf += pos;
  buf += '   ';
  return buf;
};

const compressString = (v: string): string => {
  const { length } = v;
  if (length <= WINDOW_SIZE) {
    return v;
  }
  let buf = '';
  const visible = WINDOW_SIZE - 4;
  const segSize = Math.floor(visible / 2.0);
  buf += v.substring(0, visible - segSize);
  buf += ' ... ';
  buf += v.substring(length - segSize, length);
  return buf;
};
