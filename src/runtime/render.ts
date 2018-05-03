import { Buffer, Context, Node, NodeType } from '../common';
import {
  Assignment,
  AttributeElement,
  BaseColor,
  Block,
  BlockDirective,
  BlockNode,
  Combinator,
  Comment,
  Directive,
  Element,
  Features,
  Import,
  Media,
  RGBColor,
  Rule,
  Ruleset,
  Selector,
  Selectors,
  Stylesheet,
  TextElement,
  ValueElement
} from '../model';
import { combineFeatures, combineSelectors } from './combine';
import { CssModel } from './css';
import { whitespace } from '../utils';

const EMPTY_FEATURES = new Features([], true);
const EMPTY_SELECTORS = new Selectors([]);

export class RenderFrame {

  private _selectors?: Selectors;
  private _features?: Features;

  constructor(
    readonly parent: RenderFrame | undefined,
    readonly blockNode: BlockNode,
    readonly depth: number) {}

  selectors(): Selectors {
    return this._selectors ? this._selectors : (this.parent ? this.parent.selectors() : EMPTY_SELECTORS);
  }

  features(): Features {
    return this._features ? this._features : (this.parent ? this.parent.features() : EMPTY_FEATURES);
  }

  mergeSelectors(current?: Selectors): void {
    const ancestors = this.parent ? this.parent.selectors() : EMPTY_SELECTORS;
    if (!current || current.selectors.length === 0) {
      this._selectors = ancestors;
    } else {
      this._selectors = combineSelectors(ancestors, current);
    }
  }

  pushEmptySelectors(): void {
    this._selectors = EMPTY_SELECTORS;
  }

  mergeFeatures(current: Features): void {
    const ancestors = this.parent ? this.parent.features() : EMPTY_FEATURES;
    if (!current || current.features.length === 0) {
      this._features = ancestors;
    } else {
      this._features = combineFeatures(ancestors, current);
    }
  }
}

export class RenderEnv {

  depth: number = 0;

  constructor(readonly ctx: Context, public frame?: RenderFrame) {}

  push(blockNode: BlockNode): void {
    const { type } = blockNode;
    const selectors = type === NodeType.RULESET ? (blockNode as Ruleset).selectors : undefined;
    const features = type === NodeType.MEDIA ? (blockNode as Media).features : undefined;
    this.depth++;
    this.frame = new RenderFrame(this.frame, blockNode, this.depth);
    if (type === NodeType.BLOCK_DIRECTIVE) {
      this.frame.pushEmptySelectors();
    } else if (selectors) {
      this.frame.mergeSelectors(selectors);
    } else if (features) {
      this.frame.mergeFeatures(features);
    }
  }

  pop(): void {
    this.depth--;
    if (this.frame) {
      this.frame = this.frame.parent;
    }
  }

  selectors(): Selectors {
    return this.frame ? this.frame.selectors() : EMPTY_SELECTORS;
  }

  features(): Features {
    return this.frame ? this.frame.features() : EMPTY_FEATURES;
  }
}

/**
 * Handles final rendering of the evaluated stylesheet.
 */
export class Renderer {

  readonly env: RenderEnv;
  readonly model: CssModel;

  protected constructor(readonly ctx: Context, readonly sheet: Stylesheet) {
    this.env = new RenderEnv(ctx);
    this.model = new CssModel(ctx);
  }

  static render(ctx: Context, sheet: Stylesheet): String {
    return new Renderer(ctx, sheet)._render();
  }

  protected _render(): string {
    const { block } = this.sheet;
    if (block.charset) {
      this.model.value(this.ctx.render(block.charset));
    }
    this.renderImports(block);
    this.renderBlock(block, false);
    this.env.push(this.sheet);
    this.env.pop();
    return this.model.render();
  }

  protected renderBlock(block: Block, includeImports: boolean): void {
    const { ctx, env, model } = this;
    for (const n of block.rules) {
      switch (n.type) {
        case NodeType.BLOCK_DIRECTIVE:
        {
          const o = n as BlockDirective;
          env.push(o);
          model.push(NodeType.BLOCK_DIRECTIVE);
          model.header(o.name);
          this.renderBlock(o.block, true);
          model.pop();
          env.pop();
          break;
        }

        case NodeType.COMMENT:
        {
          const o = n as Comment;
          if (o.block && (!ctx.compress || o.hasBang())) {
            model.comment(ctx.render(o));
          }
          break;
        }

        case NodeType.DIRECTIVE:
        {
          const o = n as Directive;
          if (o.name !== '@charset') {
            model.value(ctx.render(o));
          }
          break;
        }

        case NodeType.IMPORT:
          if (includeImports) {
            this.renderImport(n as Import);
          }
          break;

        case NodeType.MEDIA:
        {
          const o = n as Media;
          env.push(o);
          model.push(NodeType.MEDIA);
          model.header(`@media ${ctx.render(env.features())}`);
          this.renderRuleset(new Ruleset(EMPTY_SELECTORS, o.block));
          model.pop();
          env.pop();
          break;
        }

        case NodeType.RULE:
        {
          const o = n as Rule;
          const buf = ctx.newBuffer();
          o.property.repr(buf);
          buf.str(buf.chars.rulesep);
          o.value.repr(buf);
          if (o.important) {
            buf.str(' !important');
          }
          model.value(buf.toString());
          break;
        }

        case NodeType.RULESET:
          this.renderRuleset(n as Ruleset);
          break;
      }
    }
  }

  protected renderRuleset(r: Ruleset): void {
    this.env.push(r);
    this.model.push(NodeType.RULESET);

    const { selectors } = this.env.selectors();
    if (selectors.length > 0) {
      const buf = this.ctx.newBuffer();
      for (const selector of selectors) {
        renderSelector(buf, selector);
        this.model.header(buf.toString());
        buf.reset();
      }
    }

    this.renderBlock(r.block, true);
    this.model.pop();
    this.env.pop();
  }

  protected renderImports(block: Block): void {
    if (!block.hasImports()) {
      return;
    }
    for (const n of block.rules) {
      if (n.type === NodeType.IMPORT) {
        this.renderImport(n as Import);
      }
    }
  }

  protected renderImport(n: Import): void {
    const buf = this.ctx.newBuffer();
    buf.str('@import ');
    n.path.repr(buf);
    if (n.features) {
      buf.str(' ');
      n.features.repr(buf);
    }
    this.model.value(buf.toString());
  }

}

/**
 * Render a selector's elements for final output.
 */
const renderSelector = (buf: Buffer, selector: Selector): void => {
  let afterWildcard = false;
  const { elements } = selector;
  const len = elements.length;
  for (let i = 0; i < len; i++) {
    const elem = elements[i];
    renderElement(buf, elem, i === 0, afterWildcard);
    afterWildcard = elem.isWildcard();
  }
};

/**
 * Render a single selector element.
 */
const renderElement = (buf: Buffer, elem: Element, isFirst: boolean, afterWildcard: boolean): void => {
  const { comb } = elem;
  const isDesc = comb === Combinator.DESC;
  if (comb && !afterWildcard) {
    if (isFirst) {
      if (!isDesc) {
        buf.str(comb);
      }
    } else {
      if (!buf.compress && !isDesc && !whitespace(buf.prev)) {
        buf.str(' ');
      }
      if (!isDesc || !whitespace(buf.prev)) {
        buf.str(comb);
      }
    }

    if (!buf.compress && !whitespace(buf.prev)) {
      buf.str(' ');
    }
  }

  if (elem.isWildcard()) {
    return;
  }

  elem.repr(buf);
};
