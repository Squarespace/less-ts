import { Buffer, Node, NodeType } from '../common';
import { Features } from './media';
import { safeEquals } from '../utils';

export class Import extends Node {

  constructor(
    readonly path: Node,
    readonly once: boolean | number,
    readonly features: Features | undefined) {
    super(NodeType.IMPORT);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.IMPORT
        && this.path.equals((n as Import).path)
        && this.once === (n as Import).once
        && safeEquals(this.features, (n as Import).features);
  }

  repr(buf: Buffer): void {
    buf.str('@import');
    if (this.once) {
      buf.str('-once ');
    } else {
      buf.str(' ');
    }
    this.path.repr(buf);
    if (this.features) {
      buf.str(' ');
      this.features.repr(buf);
    }
  }
}
