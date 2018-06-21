import { Buffer, ExecEnv, Node, NodeType } from '../common';
import { Block, BlockNode } from './block';
import { arrayEquals, safeEquals } from '../utils';

export class Feature extends Node {

  constructor(
    readonly property: Node,
    readonly value: Node) {
    super(NodeType.FEATURE);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.FEATURE
        && this.property.equals((n as Feature).property)
        && this.value.equals((n as Feature).value);
  }

  repr(buf: Buffer): void {
    this.property.repr(buf);
    buf.str(': ');
    this.value.repr(buf);
  }

  needsEval(): boolean {
    return this.property.needsEval() || this.value.needsEval();
  }

  eval(env: ExecEnv): Node {
    if (!this.needsEval()) {
      return this;
    }
    return new Feature(this.property.eval(env), this.value.eval(env));
  }
}

export class Features extends Node {

  private evaluate: boolean = false;

  constructor(
    readonly features: Node[],
    skipEval: boolean = false) {
    super(NodeType.FEATURES);
    if (!skipEval) {
      for (const f of features) {
        if (f.needsEval()) {
          this.evaluate = true;
          break;
        }
      }
    }
  }

  equals(n: Node): boolean {
    return n.type === NodeType.FEATURES
        && arrayEquals(this.features, (n as Features).features);
  }

  repr(buf: Buffer): void {
    const { features } = this;
    const len = features.length;
    for (let i = 0; i < len; i++) {
      if (i > 0) {
        buf.str(', ');
      }
      features[i].repr(buf);
    }
  }

  needsEval(): boolean {
    return this.evaluate;
  }

  eval(env: ExecEnv): Node {
    if (!this.evaluate) {
      return this;
    }
    const r: Node[] = [];
    for (const n of this.features) {
      r.push(n.eval(env));
    }
    return new Features(r, true);
  }

}

export class Media extends BlockNode {

  constructor(
    readonly features: Features | undefined,
    readonly block: Block) {
    super(NodeType.MEDIA, block);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.MEDIA
        && safeEquals(this.features, (n as Media).features)
        && this.block.equals((n as Media).block);
  }

  repr(buf: Buffer): void {
    buf.str('@media ');
    if (this.features && this.features.features.length > 0) {
      this.features.repr(buf);
      buf.str(' ');
    }
    if (buf.compress) {
      buf.str('{');
    } else {
      buf.str('{\n');
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

  needsEval(): boolean {
    return true;
  }

  copy(env: ExecEnv): Media {
    const features = this.features ? this.features.eval(env) : undefined;
    return new Media(features as Features, this.block.copy());
  }

}