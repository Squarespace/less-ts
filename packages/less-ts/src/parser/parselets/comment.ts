import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet } from '../stream';
import { Comment } from '../../model/general';

export class CommentParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    return parseComment(stm, false);
  }

}

export class CommentRuleParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    return parseComment(stm, true);
  }
}

const parseComment = (stm: LessStream, ruleLevel: boolean): Node | undefined => {
  let ch = stm.peek();

  // Check for a comment start sequence, "//" or "/*"
  if (ch !== Chars.SLASH) {
    return undefined;
  }

  ch = stm.peekn(1);
  const block = ch === Chars.ASTERISK;
  const comment = ch === Chars.SLASH || block;
  if (!comment) {
    return undefined;
  }

  // Skip over start sequence
  stm.seekn(2);
  const start = stm.index;
  let end = stm.length;

  const pattern = block ? '*/' : '\n';
  if (stm.seekPast(pattern)) {
    end = stm.index - pattern.length;
  }
  stm.setOpenSpace();
  const body = stm.source.substring(start, end);
  return new Comment(body, block, ruleLevel);
};
