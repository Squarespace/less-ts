import { Node, NodeType } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { Patch } from '../../compat';
import { Block, Comment, Ruleset, Selectors, Stylesheet } from '../../model';
import { DUMMY_MEDIA } from './directive';

export class PrimaryParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    const block = new Block();
    let node: Node | undefined;
    stm.skipEmpty();

    while (true) {
      // BUG1: at legacy levels a stray '+' directly before the closing
      // brace is dropped and the brace ends the block.
      if (this.skipStrayPlus(stm)) {
        continue;
      }
      try {
        node = stm.parse(Parselets.PRIMARY_SUB);
      } catch (e) {
        if (!stm.ctx.safeMode()) {
          throw e;
        }
        // A sub-parse threw a hard error. Same treatment as a fall-
        // through: drop the invalid region at the next synchronization
        // point and continue with the next statement.
        stm.recover('invalid statement');
        continue;
      }
      if (node === undefined) {
        // A block terminator or the end of input is not a failure.
        // Otherwise, in recovery mode, drop the invalid region at the
        // next synchronization point and keep parsing.
        const ch = stm.peek();
        if (ch === Chars.RIGHT_CURLY_BRACKET) {
          if (stm.openBlocks > 0) {
            break;
          }
          // A '}' at stylesheet scope closes nothing.
          if (stm.ctx.safeMode()) {
            stm.recover('invalid statement');
            continue;
          }
          stm.parseError("SyntaxError GENERAL unexpected '}' closing brace");
        }
        if (ch !== undefined && stm.ctx.safeMode()) {
          stm.recover('invalid statement');
          continue;
        }
        break;
      }
      if (node === DUMMY_MEDIA) {
        // A tolerated block-less @media: the directive is dropped and
        // the statements that follow attach to the enclosing block.
        // It must not count as output for the empty-sheet check.
        stm.skipEmpty();
        continue;
      }
      if (node.type === NodeType.BLOCK) {
        block.appendBlock(node as Block);
      } else {
        block.add(node);
      }
      stm.skipEmpty();
    }
    stm.skipEmpty();
    return block;
  }

  // BUG1 (legacy): consume a stray '+' when the next statement is a
  // closing brace. Only whitespace may sit between the two; on a miss
  // the stream is restored so the statement fails as usual.
  private skipStrayPlus(stm: LessStream): boolean {
    if (!stm.ctx.compat.enabled(Patch.BUG1) || stm.peek() !== Chars.PLUS_SIGN) {
      return false;
    }
    const mark = stm.mark();
    stm.seek1();
    stm.skipWs();
    if (stm.peek() !== Chars.RIGHT_CURLY_BRACKET) {
      stm.restore(mark);
      return false;
    }
    return true;
  }
}

export class BlockParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    stm.skipWs();
    if (stm.peek() !== Chars.LEFT_CURLY_BRACKET) {
      return undefined;
    }
    const mark = stm.mark();
    stm.seekOpenSpace();
    stm.openBlocks++;
    const block = stm.parse(Parselets.PRIMARY);
    stm.skipEmpty();
    if (stm.peek() === Chars.RIGHT_CURLY_BRACKET) {
      stm.seekOpenSpace();
      stm.openBlocks--;
      return block;
    }
    if (stm.peek() === undefined) {
      // A block that runs off the end of input keeps its partial
      // contents; the stylesheet completion check reports the open
      // block (strict: error, safe: truncation warning).
      return block;
    }
    stm.openBlocks--;
    stm.restore(mark);
    return undefined;
  }
}

export class RulesetParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    const selectors = stm.parse(Parselets.SELECTORS);
    if (selectors === undefined) {
      // A failed selector scan may have consumed a combinator or a
      // stray token; undo it so the statement fails from its start.
      stm.restore(mark);
      return undefined;
    }
    const block = stm.parse(Parselets.BLOCK);
    if (block === undefined) {
      stm.restore(mark);
      return undefined;
    }
    return new Ruleset(selectors as Selectors, block as Block);
  }
}

export class StylesheetParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    const block = stm.parse(Parselets.PRIMARY);
    const sheet = new Stylesheet(block as Block);
    stm.checkComplete();
    // Recovery that rescues nothing is a broken sheet: a hard error
    // even in safe mode, so a green build never ships a blank
    // stylesheet. Comments do not count as output; definitions do (a
    // def-only sheet is a legitimate variables file).
    if (stm.ctx.safeMode() && stm.recovered > 0 && emptyOfNonComment(block as Block)) {
      stm.parseError('SyntaxError GENERAL stylesheet produced no output; all input was skipped during recovery');
    }
    return sheet;
  }
}

// True when the block holds no rule other than comments.
const emptyOfNonComment = (block: Block): boolean => {
  for (const n of block.rules) {
    if (!(n instanceof Comment)) {
      return false;
    }
  }
  return true;
};
