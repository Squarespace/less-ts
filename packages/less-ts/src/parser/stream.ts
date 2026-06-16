import { Context, LessParseError, Node } from '../common';
import { whitespace } from '../utils';
import { Chars, isSkippable } from './types';
import { UNITS } from '../model';

/**
 * Parses a fragment of the LESS syntax.
 */
export interface Parselet {
  parse(stm: LessStream): Node | undefined;
}

export type Mark = [number, number, number, number];

export const enum StreamFlags {
  OPENSPACE = 1,
}

const { max } = Math;

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

  // Exponent-aware number: '1e2', '2E2', '1.5e-3'. 'e' is an
  // exponent only when a digit or sign follows, so units like 'em'
  // or 'ex' never get swallowed (the unit is matched separately).
  DIMENSION_VALUE = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?',
  // Released 1.7.2 numeric grammar: no exponent part. '1e3'
  // tokenizes as number 1 + identifier 'e3'. The legacy side of
  // Patch.NUMBER_EXPO; level 0 must match the release exactly.
  DIMENSION_VALUE_LEGACY = '[+-]?\\d*\\.?\\d+',
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
  PROPERTY = '\\*?-?[_a-zA-Z0-9-]+',
  RATIO = '\\d+\\/\\d+',
  SHORTHAND = '[@\\w.%-]+\\/[@\\w.-]+',
  UNICODE_RANGE = 'U\\+[A-Fa-f0-9?]+(\\-[A-Fa-f0-9?]+)?',
  WHEN = 'when',
  WORD = '\\w+',
}

const compile = (s: string, caseInsensitive: boolean = false): RegExp => new RegExp(s, caseInsensitive ? 'iy' : 'y');

export class LessStream {
  index: number = 0;
  flags: number = 0;
  furthest: number = 0;

  // Recovery (safe mode): number of regions dropped by recover().
  // A top-level parse that recovers and still produces nothing but
  // comments is a broken sheet (the C6 check in the stylesheet
  // parselet).
  recovered: number = 0;
  // Scan start of the last recovery, for the repeated-start guard.
  private lastRecoverStart: number = -1;

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
  private readonly dimensionValueLegacy: RegExp = compile(Patterns.DIMENSION_VALUE_LEGACY);
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

  constructor(
    readonly ctx: Context,
    readonly source: string,
  ) {
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

  matchDimensionValueLegacy(): boolean {
    return this.finish(this.test(this.dimensionValueLegacy, this.index));
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
      this.parseError(parseError());
    }
  }

  /**
   * Throw a typed parse error carrying the given message. The public
   * parse() lets it propagate; compile() converts it into a
   * LessErrorEvent and returns it with empty css.
   */
  parseError(message: string): never {
    throw new LessParseError(message);
  }

  /**
   * Best-effort recovery (safe mode): drops the invalid region starting
   * at the current position, resynchronizes at a well-defined boundary,
   * and records a warning. The forward scan tracks brace depth and skips
   * strings and comments. The sync point is:
   *   - a '{' at depth 0: when its balanced block closes, resume at the
   *     statement's line start (the caller's loop re-parses it fresh);
   *   - a ';' at depth 0: resume at the following statement's line start
   *     when strictly past the scan start, otherwise consume the ';';
   *   - a '}' at depth 0 with no candidate block: left for the caller
   *     (consumed only when it is the region's first character).
   * With no sync point the remainder of the stream is dropped and the
   * warning records the truncation. Terminates: resuming at the scan
   * start itself is allowed once; the repeated-start guard drops the
   * candidate afterwards, so positions strictly advance from the
   * second recovery onward.
   */
  recover(what: string): void {
    const source = this.source;
    const len = this.length;
    const start = this.index;
    const startLine = this.lineAt(start);
    let depth = 0;
    let quote = '';
    // Resuming at the scan start itself is a one-shot opportunity.
    const repeatedStart = start === this.lastRecoverStart;
    let resume = -1;
    // Offset just after the most recent newline crossed outside strings
    // and comments: the next statement's line start. The first such
    // newline closes the garbage line; later newlines are mid-statement
    // (multi-line declarations and selector lists are valid LESS) and
    // are not boundaries.
    let lastBoundary = start;
    let firstLine = true;
    let i = start;
    while (i < len) {
      const c = source[i];
      if (quote !== '') {
        // Inside a string: skip backslash-escaped characters so an
        // escaped quote cannot desync the scanner.
        if (c === Chars.BACKSLASH) {
          i += 2;
          continue;
        }
        if (c === quote) {
          quote = '';
          i++;
          continue;
        }
        if (c === '\n') {
          // A string with a bare line feed is invalid LESS anyway and
          // the region is being dropped: end the phantom string at the
          // newline so it cannot swallow sync points across lines.
          quote = '';
          lastBoundary = i + 1;
        }
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        i++;
        continue;
      }
      if (c === Chars.SLASH) {
        const n = source[i + 1];
        if (n === Chars.ASTERISK) {
          const end = source.indexOf('*/', i + 2);
          i = end < 0 ? len : end + 2;
          continue;
        }
        if (n === Chars.SLASH) {
          const end = source.indexOf('\n', i + 2);
          i = end < 0 ? len : end + 1;
          // A line comment ends at its newline, a boundary only under
          // the generic-newline rule.
          if (end >= 0 && firstLine) {
            lastBoundary = end + 1;
            firstLine = false;
          }
          continue;
        }
      }
      if (c === Chars.LEFT_CURLY_BRACKET) {
        if (depth === 0 && resume < 0) {
          if (lastBoundary > start || (lastBoundary === start && !repeatedStart)) {
            resume = lastBoundary;
          }
        }
        depth++;
        i++;
        continue;
      }
      if (c === Chars.RIGHT_CURLY_BRACKET) {
        if (depth === 0) {
          // No candidate block: the '}' (or the offending token itself)
          // is the sync point, left for the caller.
          this.index = (i === start) ? i + 1 : i;
          this.syncTo(what, startLine, start, '');
          return;
        }
        depth--;
        if (depth === 0 && resume >= start) {
          // The candidate statement's block closed: re-parse it fresh.
          this.index = resume;
          this.syncTo(what, startLine, start, '');
          return;
        }
        i++;
        continue;
      }
      if (c === Chars.SEMICOLON && depth === 0) {
        // The ';' terminates the statement that follows the broken one.
        if (lastBoundary > start) {
          this.index = lastBoundary;
        } else {
          this.index = i + 1;
        }
        this.syncTo(what, startLine, start, '');
        return;
      }
      if (c === '\n' && firstLine) {
        lastBoundary = i + 1;
        firstLine = false;
      }
      i++;
    }
    // No sync point found: drop the remainder of the stream.
    this.index = (resume >= start) ? resume : len;
    this.syncTo(what, startLine, start, '; rest of input truncated');
  }

  /**
   * Completes a recovery jump: fast-forwards the incremental line and
   * column counters (and furthest) past the dropped region so nodes
   * parsed after the jump get correct positions, and records the
   * warning for the skipped region.
   */
  private syncTo(what: string, startLine: number, start: number, suffix: string): void {
    this.lastRecoverStart = start;
    let newline = -1;
    for (let i = start; i < this.index; i++) {
      if (this.source[i] === '\n') {
        this.lineOffset++;
        newline = i;
      }
    }
    this.charOffset = (newline < 0) ? this.charOffset + (this.index - start) : this.index - newline - 1;
    this.furthest = max(this.index, this.furthest);
    this.recovered++;
    this.ctx.addWarning('skipped ' + what + ' at line ' + startLine + suffix);
  }

  /**
   * Absolute 1-based line of an offset in the source. The incremental
   * line counter can drift when marks and rollbacks straddle
   * whitespace, so recovery diagnostics use this instead.
   */
  lineAt(offset: number): number {
    let line = 1;
    for (let i = 0; i < offset && i < this.length; i++) {
      if (this.source[i] === '\n') {
        line++;
      }
    }
    return line;
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
      this.seekn(i + pattern.length - this.index);
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

/**
 * The message Java attaches to a parse that cannot complete. The source
 * position is not part of the message.
 */
export const parseError = (): string => 'SyntaxError INCOMPLETE_PARSE Unable to complete parse.';
