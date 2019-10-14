/*
 * NOTE: We depend on Set.keys traversal by insertion order.
 * This can be removed once IE 11 support is no longer needed.
 */
import 'core-js/es/set';

import { Buffer, Context, NodeType } from '../common';
import { setOf } from '../utils';

const ACCEPT_BLOCK_DIRECTIVE = setOf(
  NodeType.BLOCK_DIRECTIVE,
  NodeType.RULESET
);

const ACCEPT_MEDIA = ACCEPT_BLOCK_DIRECTIVE;

const ACCEPT_RULESET: Set<NodeType> = new Set();

const ACCEPT_STYLESHEET = setOf(
  NodeType.BLOCK_DIRECTIVE,
  NodeType.MEDIA,
  NodeType.RULESET,
  NodeType.STYLESHEET
);

/**
 * Supports rendering by modeling valid containment of blocks in a CSS
 * stylesheet.
 */
export class CssModel {

  private stack: CssBlock[] = [];
  private current: CssBlock;

  /**
   * We intern the strings added to the model for a few reasons:
   *
   * 1. To ensure uniqueness: only one occurrence of a line inside a block
   * 2. To distinguish between comments and rules, when both are strings.
   *    Comments are represented by negative offsets and rules are positive.
   * 3. To reduce slightly on string duplication. For example, if "color: red"
   *    is used in multiple blocks, we map it to a single identifier.
   */
  private stringMap: Map<string, number> = new Map();
  private strings: string[] = [''];

  constructor(readonly ctx: Context) {
    this.current = new CssBlock(NodeType.STYLESHEET);
  }

  /**
   * Render the model to a string.
   */
  render(): string {
    const buf = this.ctx.newBuffer();
    this.renderBlock(buf, this.current);
    return buf.toString();
  }

  /**
   * Push a block into the model. The model will move the block up the
   * stack until it finds an acceptable parent. For example, MEDIA
   * nodes can only be defined at the outermost scope. RULESET can
   * have a MEDIA or BLOCK_DIRECTIVE node as a parent, etc.
   */
  push(type: NodeType): void {
    this.stack.push(this.current);
    const child = new CssBlock(type);
    this.defer(child);
    this.current = child;
  }

  /**
   * Pop the current block off the stack.
   */
  pop(): void {
    const parent = this.current.parent;
    if (parent) {
      parent.populated = parent.populated || this.current.populated;
    }
    const block = this.stack.pop();
    if (block) {
      this.current = block;
    }
  }

  /**
   * Append a header string to the model.
   */
  header(s: string): void {
    this.current.headers.push(s);
  }

  /**
   * Append a comment string to the model.
   */
  comment(s: string): void {
    const id = -this.intern(s);
    this.current.add(id);
  }

  /**
   * Append a rule string to the model.
   */
  value(s: string): void {
    const id = this.intern(s);
    this.current.add(id);
  }

  protected renderBlock(buf: Buffer, block: CssBlock): void {
    if (!block.populated) {
      return;
    }
    const { headers, nodes } = block;
    const { length } = headers;
    const { selectorsep } = buf.chars;
    if (length > 0) {
      for (let i = 0; i < length; i++) {
        if (i > 0) {
          buf.str(selectorsep);
        }
        buf.indent();
        buf.str(headers[i]);
      }
      buf.blockOpen();
    }

    const { ruleend } = buf.chars;
    const iter = nodes.keys();
    let elem = iter.next();
    while (!elem.done) {
      const { value } = elem;
      let isval = false;
      if (typeof value === 'number') {
        const s = this.get(value);
        buf.indent();
        buf.str(s);
        isval = value >= 0;
      } else {
        this.renderBlock(buf, value);
      }
      elem = iter.next();
      if (isval && (!buf.compress || !elem.done)) {
        buf.str(ruleend);
      }
    }

    if (length > 0) {
      buf.blockClose();
    }
  }

  /**
   * Fetch a string with the given id. Note we need to invert the
   * negative indices (for comment strings)
   */
  protected get(i: number): string {
    return this.strings[i < 0 ? -i : i];
  }

  /**
   * Push a block up the stack until it finds its correct parent.
   */
  protected defer(child: CssBlock): void {
    const len = this.stack.length;
    for (let i = len - 1; i >= 0; i--) {
      if (this.stack[i].accept(child)) {
        return;
      }
    }
  }

  /**
   * Assign a unique identifier to each string and return it.
   */
  protected intern(s: string): number {
    let i = this.stringMap.get(s);
    if (i === undefined) {
      i = this.strings.length;
      this.strings.push(s);
      this.stringMap.set(s, i);
    }
    return i;
  }
}

/**
 * A generic CSS block having a parent, one or more headers and
 * zero or more rules. Empty blocks will be filtered from the
 * model.
 */
export class CssBlock {

  parent: CssBlock | undefined;
  populated: boolean = false;

  // Set of block types that are allowed to be children of this block.
  readonly filter: Set<NodeType>;

  // List of header strings (e.g. RULESET selectors, MEDIA features)
  readonly headers: string[] = [];

  // Rules inside this block. A number references an interned string.
  readonly nodes: Set<CssBlock | number>;

  constructor(readonly type: NodeType) {
    this.nodes = new Set();
    switch (type) {
      case NodeType.BLOCK_DIRECTIVE:
        this.filter = ACCEPT_BLOCK_DIRECTIVE;
        break;
      case NodeType.MEDIA:
        this.filter = ACCEPT_MEDIA;
        break;
      case NodeType.STYLESHEET:
        this.filter = ACCEPT_STYLESHEET;
        break;
      case NodeType.RULESET:
      default:
        this.filter = ACCEPT_RULESET;
        break;
    }
  }

  /**
   * Add a string with the given identifier to this block.
   */
  add(id: number): void {
    // Set entries are always traversed in order of insertion. To ensure the last
    // unique rule wins, we must always attempt to remove and then add the element.
    // In a V8 microbenchmark Set.has has same complexity as Set.delete so we blindly
    // delete before we add.
    this.nodes.delete(id);
    this.nodes.add(id);
    this.populated = true;
  }

  /**
   * Check if the given block type can be a child of ourselves. If so, add
   * it, set its parent and return true. Otherwise return false.
   */
  accept(block: CssBlock): boolean {
    if (this.filter.has(block.type)) {
      this.nodes.add(block);
      block.parent = this;
      return true;
    }
    return false;
  }

}
