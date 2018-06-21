import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { Block, BlockDirective, Directive, Features, Import, Media } from '../../model';

export class DirectiveParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    stm.skipWs();
    if (stm.peek() !== Chars.AT_SIGN || !stm.matchDirective()) {
      return undefined;
    }

    let name = stm.token();
    let nvName = name;
    if (name[1] === Chars.MINUS_SIGN) {
      const index = name.indexOf(Chars.MINUS_SIGN, 2);
      if (index > 0) {
        nvName = '@' + name.substring(index + 1);
      }
    }

    let hasBlock = false;
    let hasExpression = false;
    let hasIdentifier = false;
    switch (nvName) {
      case '@import':
      case '@import-once':
        const result = this.parseImport(stm, nvName);
        if (result === undefined) {
          stm.restore(mark);
        }
        return result;

      case '@media':
        return this.parseMedia(stm);

      case '@font-face':
      case '@viewport':
      case '@top-left':
      case '@top-left-corner':
      case '@top-center':
      case '@top-right':
      case '@top-right-corner':
      case '@bottom-left':
      case '@bottom-left-corner':
      case '@bottom-center':
      case '@bottom-right':
      case '@bottom-right-corner':
      case '@left-top':
      case '@left-middle':
      case '@left-bottom':
      case '@right-top':
      case '@right-middle':
      case '@right-bottom':
        hasBlock = true;
        break;

      case '@page':
      case '@document':
      case '@supports':
      case '@keyframes':
        hasBlock = true;
        hasIdentifier = true;
        break;

      case '@namespace':
        hasExpression = true;
        break;

      default:
        break;
    }

    if (hasIdentifier) {
      name += this.parseIdentifier(stm);
    }

    if (hasBlock) {
      const block = stm.parse(Parselets.BLOCK);
      if (block !== undefined) {
        return new BlockDirective(name, block as Block);
      }
    } else {
      const value = this.parseRest(stm, hasExpression);
      if (value !== undefined) {
        return new Directive(name, value);
      }
    }

    stm.restore(mark);
    return undefined;
  }

  parseMedia(stm: LessStream): Node | undefined {
    const features = stm.parse(Parselets.FEATURES);
    const block = stm.parse(Parselets.BLOCK);
    if (block === undefined) {
      return undefined;
    }
    return new Media(features as Features, block as Block);
  }

  parseImport(stm: LessStream, name: string): Node | undefined {
    const once = name.endsWith('-once');
    const path = stm.parse(Parselets.DIRECTIVE_IMPORT);
    if (path === undefined) {
      return undefined;
    }
    const features = stm.parse(Parselets.FEATURES);
    stm.skipWs();
    if (stm.seekIf(Chars.SEMICOLON)) {
      const node = new Import(path, once, features as Features);
      // TODO: complete importer implementation
      return node;
    }
    return undefined;
  }

  parseIdentifier(stm: LessStream): string {
    let buf = '';
    stm.skipWs();
    let ch = stm.peek();
    while (ch !== undefined && ch !== Chars.LEFT_CURLY_BRACKET && ch !== Chars.LEFT_SQUARE_BRACKET) {
      buf += ch;
      stm.seek1();
      ch = stm.peek();
    }
    return ' ' + buf.trim();
  }

  parseRest(stm: LessStream, hasExpression: boolean): Node | undefined {
    const parselet = hasExpression ? Parselets.EXPRESSION : Parselets.ENTITY;
    const value = stm.parse(parselet);
    stm.skipWs();
    if (stm.seekIf(Chars.SEMICOLON)) {
      return value;
    }
    return undefined;
  }
}
