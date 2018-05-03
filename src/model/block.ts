import { Buffer, ExecEnv, IBlockNode, Node, NodeType } from '../common';
import { Directive } from './general';
import { Definition } from './variable';

export const enum BlockFlags {
  REBUILD_VARS = 1,
  HAS_IMPORTS = 2,
  HAS_MIXIN_CALLS = 4
}

export class Block extends Node {

  readonly rules: Node[];
  charset?: Directive;
  protected variables: { [x: string]: Definition } = {};

  // Flags used for triggering var cache rebuilds or skipping blocks
  // that have no imports or mixin calls.
  protected flags: number = BlockFlags.REBUILD_VARS;

  constructor(rules?: Node[]) {
    super(NodeType.BLOCK);
    this.rules = rules || [];
  }

  hasImports(): boolean {
    return (this.flags & BlockFlags.HAS_IMPORTS) !== 0;
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
    if (n.type === NodeType.IMPORT) {
      this.flags |= BlockFlags.HAS_IMPORTS;
    } else if (n.type === NodeType.MIXIN_CALL) {
      this.flags |= BlockFlags.HAS_MIXIN_CALLS;
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

  original?: BlockNode;

  constructor(readonly type: NodeType, readonly block: Block) {
    super(type);
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
    super(NodeType.BLOCK_DIRECTIVE, block);
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

}

export class Stylesheet extends BlockNode {

  constructor(readonly block: Block) {
    super(NodeType.STYLESHEET, block);
  }

  repr(buf: Buffer): void {
    this.block.repr(buf);
  }
}
