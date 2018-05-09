import { Buffer, ExecEnv, IBlock, IBlockNode, Node, NodeType } from '../common';
import { Directive } from './general';
import { Definition } from './variable';
import { arrayEquals } from '../utils';

export const enum BlockFlags {
  REBUILD_VARS = 1,
  HAS_IMPORTS = 2,
  HAS_MIXIN_CALLS = 4,
  HAS_MIXIN_OR_RULESET = 8
}

export class Block extends Node implements IBlock {

  readonly rules: Node[] = [];
  charset?: Directive;
  protected variables: { [x: string]: Definition } = {};

  // Flags used for triggering var cache rebuilds or skipping blocks
  // that have no imports or mixin calls.
  protected flags: number = BlockFlags.REBUILD_VARS;

  constructor(rules?: Node[]) {
    super(NodeType.BLOCK);
    if (rules) {
      for (const r of rules) {
        this.add(r);
      }
    }
  }

  equals(n: Node): boolean {
    return n.type === NodeType.BLOCK
        && arrayEquals(this.rules, (n as Block).rules);
  }

  hasImports(): boolean {
    return (this.flags & BlockFlags.HAS_IMPORTS) !== 0;
  }

  hasMixinCalls(): boolean {
    return (this.flags & BlockFlags.HAS_MIXIN_CALLS) !== 0;
  }

  hasMixinDefs(): boolean {
    return (this.flags & BlockFlags.HAS_MIXIN_OR_RULESET) !== 0;
  }

  resolveDefinition(name: string): Definition | undefined {
    if ((this.flags & BlockFlags.REBUILD_VARS) !== 0) {
      this.rebuildVariables();
    }
    return this.variables[name];
  }

  repr(buf: Buffer): void {
    const { rules } = this;
    const len = rules.length;
    const end = len - 1;
    const emit = !buf.compress;
    for (let i = 0; i < len; i++) {
      const n = rules[i];
      if (n === undefined) {
        continue;
      }
      if (emit) {
        buf.indent();
      }
      n.repr(buf);

      // Line endings.
      if (!(n instanceof BlockNode) && n.type !== NodeType.COMMENT) {
        if (emit || i < end) {
          buf.str(';');
        }
        if (emit) {
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
    const { type } = n;
    if (type === NodeType.IMPORT) {
      this.flags |= BlockFlags.HAS_IMPORTS;
    }
    if (type === NodeType.MIXIN_CALL) {
      this.flags |= BlockFlags.HAS_MIXIN_CALLS;
    }
    if (type === NodeType.RULESET || type === NodeType.MIXIN) {
      this.flags |= BlockFlags.HAS_MIXIN_OR_RULESET;
    }
  }

  protected rebuildVariables(): void {
    this.variables = {};
    const { rules } = this;
    const len = rules.length;
    for (let i = 0; i < len; i++) {
      const rule = rules[i];
      if (rule.type === NodeType.DEFINITION) {
        this.variables[(rule as Definition).name] = rule as Definition;
      }
    }
    this.flags = this.flags & ~BlockFlags.REBUILD_VARS;
  }
}

export abstract class BlockNode extends Node implements IBlockNode {

  readonly original: BlockNode;

  constructor(readonly type: NodeType, readonly block: Block, original?: BlockNode) {
    super(type);
    this.original = original || this;
  }

  repr(buf: Buffer): void {
    // NOOP
  }

}

export class BlockDirective extends BlockNode {

  constructor(
    readonly name: string,
    block: Block) {
    super(NodeType.BLOCK_DIRECTIVE, block);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.BLOCK_DIRECTIVE
        && this.name === (n as BlockDirective).name
        && this.block.equals((n as BlockDirective).block);
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
    super(NodeType.GENERIC_BLOCK, block);
  }

  equals(n: Node): boolean {
    return this.type === NodeType.GENERIC_BLOCK
        && this.block.equals((n as GenericBlock).block);
  }

}

export class Stylesheet extends BlockNode {

  constructor(readonly block: Block) {
    super(NodeType.STYLESHEET, block);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.STYLESHEET
        && this.block.equals((n as Stylesheet).block);
  }

  repr(buf: Buffer): void {
    this.block.repr(buf);
  }
}
