import { Buffer, LessErrorEvent, Node, NodeRenderer, NodeType } from '../common';
import { RuntimeContext } from './context';
import { BlockDirective, BlockNode, Media, Mixin, Ruleset } from '../model';

export class ErrorFormatter {

  readonly ctx: RuntimeContext;

  constructor(readonly frameWindow: number, readonly renderer: NodeRenderer) {
    this.ctx = new RuntimeContext({ compress: false, indentSize: 4 }, renderer);
  }

  format(events: LessErrorEvent[]): string[] {
    const res: string[] = [];
    for (const event of events) {
      res.push(this.formatEvent(event));
    }
    return res;
  }

  protected formatEvent(event: LessErrorEvent): string {
    const { errors, node, stack } = event;
    if (errors.length === 0) {
      return '';
    }

    const buf = this.ctx.newBuffer();
    for (const e of errors) {
      buf.str(`Error: ${e.message}:\n`);
    }

    let skipped = 0;
    const len = stack.length;
    const thresh = this.frameWindow * 2;
    const limit = len - this.frameWindow - 1;

    for (let i = 0; i < len; i++) {
      if (len <= thresh || i < this.frameWindow || i > limit) {
        if (skipped > 0) {
          buf.str('\n');
          buf.indent();
          buf.str(`... skipped ${skipped} frames\n\n`);
          skipped = 0;
        }

        const n = stack[i];
        this.renderStackFrame(buf, n as BlockNode);
      } else {
        skipped++;
      }
    }

    buf.str(' ==>');
    buf.indent();
    this.renderNode(buf, node);

    return buf.toString();
  }

  protected renderStackFrame(buf: Buffer, n: BlockNode): void {
    switch (n.type) {
      case NodeType.BLOCK_DIRECTIVE:
        buf.incr();
        buf.indent();
        buf.str((n as BlockDirective).name);
        buf.str(' {');
        break;

      case NodeType.MEDIA:
        {
          buf.incr();
          buf.indent();
          const m = n as Media;
          buf.str('@media');
          if (m.features) {
            buf.str(' ');
            m.features.repr(buf);
          }
          buf.str(' {');
          break;
        }

      case NodeType.MIXIN:
      {
        buf.incr();
        buf.indent();
        const m = n as Mixin;
        buf.str(m.name).str('(');
        if (m.params) {
          m.params.repr(buf);
        }
        buf.str(')');
        if (m.guard) {
          buf.str(' when ');
          m.guard.repr(buf);
        }
        buf.str(' {');
        break;
      }

      case NodeType.RULESET:
      {
        buf.incr();
        buf.indent();
        const { selectors } = (n as Ruleset).selectors;
        const len = selectors.length;
        for (let i = 0; i < len; i++) {
          if (i > 0) {
            buf.str(',\n');
            buf.indent();
          }
          selectors[i].repr(buf);
        }
        buf.str(' {');
        break;
      }

      default:
        // STYLESHEET has no representation
        return;
    }
    buf.str('\n');
  }

  protected renderNode(buf: Buffer, n: Node): void {
    switch (n.type) {
      case NodeType.DEFINITION:
      case NodeType.DIRECTIVE:
      case NodeType.MIXIN_CALL:
      case NodeType.RULE:
        n.repr(buf);
        break;

      default:
        return;
    }
    buf.str('\n');
  }
}
