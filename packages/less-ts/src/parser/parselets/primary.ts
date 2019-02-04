import { Node, NodeType } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { Block, Ruleset, Selectors, Stylesheet } from '../../model';

export class PrimaryParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const block = new Block();
    let node: Node | undefined;
    stm.skipEmpty();

    const pos = stm.mark();
    node = stm.parse(Parselets.PRIMARY_SUB);
    while (node !== undefined) {
      if (node.type === NodeType.BLOCK) {
        block.appendBlock(node as Block);
      } else {
        block.add(node);
      }
      stm.skipEmpty();
      stm.mark(pos);
      node = stm.parse(Parselets.PRIMARY_SUB);
    }
    stm.skipEmpty();
    return block;
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
    const block = stm.parse(Parselets.PRIMARY);
    stm.skipEmpty();
    if (stm.peek() !== Chars.RIGHT_CURLY_BRACKET) {
      stm.restore(mark);
      return undefined;
    }
    stm.seekOpenSpace();
    return block;
  }
}

export class RulesetParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    const selectors = stm.parse(Parselets.SELECTORS);
    if (selectors === undefined) {
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
    return sheet;
  }
}
