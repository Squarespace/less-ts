
export interface DefinitionBase {
  dereference(env: ExecEnv): Node;
}

// Execution environment exposed to nodes for evaluation
export interface ExecEnv {
  resolveDefinition(name: string): DefinitionBase | undefined;
  push(node: BlockNode): void;
  pop(): void;
}

export interface Buffer {
  readonly compress: boolean;
  str(s: string): Buffer;
  num(n: number): Buffer;
  indent(): Buffer;
  incr(): void;
  decr(): void;
  listsep(): Buffer;
  prevchar(): string;
}

// Types of nodes in the syntax
export const enum NodeType {
  ALPHA,
  ANONYMOUS,
  ARGUMENT,
  ASSIGNMENT,
  BLOCK,
  BLOCK_DIRECTIVE,
  COLOR,
  COMMENT,
  CONDITION,
  DEFINITION,
  DIMENSION,
  DIRECTIVE,
  ELEMENT,
  EXPRESSION,
  EXPRESSION_LIST,
  FALSE,
  FEATURE,
  FEATURES,
  FUNCTION_CALL,
  GENERIC_BLOCK,
  GUARD,
  IMPORT,
  IMPORT_MARKER,
  KEYWORD,
  MEDIA,
  MIXIN,
  MIXIN_ARGS,
  MIXIN_CALL,
  MIXIN_MARKER,
  MIXIN_PARAMS,
  OPERATION,
  PARAMETER,
  PAREN,
  PARSE_ERROR,
  PROPERTY,
  QUOTED,
  RATIO,
  RULE,
  RULESET,
  SELECTOR,
  SELECTORS,
  SHORTHAND,
  STYLESHEET,
  TRUE,
  UNICODE_RANGE,
  URL,
  VARIABLE
}

// Abstract node
export abstract class Node {

  abstract type(): NodeType;
  abstract repr(buf: Buffer): void;

  needsEval(): boolean {
    return false;
  }

  eval(env: ExecEnv): Node {
    return this;
  }

}

export class Directive extends Node {

  constructor(
    readonly name: string,
    readonly value: Node) {
    super();
  }

  type(): NodeType {
    return NodeType.DIRECTIVE;
  }

  repr(buf: Buffer): void {
    buf.str(this.name);
    buf.str(' ');
    this.value.repr(buf);
  }

  needsEval(): boolean {
    return this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    return this.needsEval() ? new Directive(this.name, this.value.eval(env)) : this;
  }
}

export const enum BlockFlags {
  REBUILD_VARS = 1,
  HAS_IMPORTS = 2,
  HAS_MIXIN_CALLS = 4
}

export class Block extends Node {

  protected flags: number = BlockFlags.REBUILD_VARS;
  charset?: Directive;

  constructor(readonly rules: Node[] = []) {
    super();
  }

  type(): NodeType {
    return NodeType.BLOCK;
  }

  repr(buf: Buffer): void {
    const { rules } = this;
    const len = rules.length;
    for (let i = 0; i < len; i++) {
      const n = rules[i];
      if (n === undefined) {
        continue;
      }
      if (!buf.compress) {
        buf.indent();
      }
      n.repr(buf);
      if (!(n instanceof BlockNode) && n.type() !== NodeType.COMMENT) {
        if (!buf.compress || i + 1 < len) {
          buf.str(';');
        }
        if (!buf.compress) {
          buf.str('\n');
        }
      }
    }
  }

  copy(): Block {
    const r = new Block(this.rules.slice(0));
    r.charset = this.charset;
    r.flags = this.flags;
    return r;
  }

  add(n: Node): void {
    this.rules.push(n);
  }
}

export abstract class BlockNode extends Node {

  original?: BlockNode;

  constructor(readonly block: Block) {
    super();
    this.original = this;
  }

  repr(buf: Buffer): void {
    // NOOP
  }

}

export class BlockDirective extends BlockNode {

  constructor(
    readonly name: string,
    block: Block) {
    super(block);
  }

  type(): NodeType {
    return NodeType.BLOCK_DIRECTIVE;
  }

  repr(buf: Buffer): void {
    buf.str(this.name);
    if (buf.compress) {
      buf.str('{');
    } else {
      buf.str(' {\n');
    }
    buf.incr();
    this.block.repr(buf);
    buf.decr();
    if (buf.compress) {
      buf.str('}');
    } else {
      buf.indent().str('}\n');
    }
  }

  copy(): BlockDirective {
    return new BlockDirective(this.name, this.block.copy());
  }
}

export class GenericBlock extends BlockNode {

  constructor(block: Block) {
    super(block);
  }

  type(): NodeType {
    return NodeType.GENERIC_BLOCK;
  }

}

export class Stylesheet extends BlockNode {

  constructor(readonly block: Block) {
    super(block);
  }

  type(): NodeType {
    return NodeType.STYLESHEET;
  }

  repr(buf: Buffer): void {
    this.block.repr(buf);
  }
}
