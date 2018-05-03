import { Buffer, Node, NodeType } from '../common';
import { Features } from './media';

export class Import extends Node {

  constructor(
    readonly path: Node,
    readonly once: boolean | number,
    readonly features: Features | undefined) {
    super(NodeType.IMPORT);
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
