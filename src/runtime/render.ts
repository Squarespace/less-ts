import { Buffer, Context, Node, NodeType } from '../common';
import {
  Alpha,
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
  Expression,
  ExpressionList,
  Feature,
  Features,
  FunctionCall,
  Import,
  Media,
  Paren,
  Quoted,
  Rule,
  Ruleset,
  RGBColor,
  Selector,
  Selectors,
  Shorthand,
  Stylesheet,
  TextElement,
  Url,
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

  protected constructor(readonly ctx: Context) {
    this.env = new RenderEnv(ctx);
    this.model = new CssModel(ctx);
  }

  static render(ctx: Context, sheet: Stylesheet): string {
    return new Renderer(ctx)._render(sheet);
  }

  static renderBlock(ctx: Context, block: Block): string {
    const renderer = new Renderer(ctx);
    renderer._renderBlock(block, false);
    return renderer.model.render();
  }

  static renderNode(ctx: Context, rule: Node): string {
    const renderer = new Renderer(ctx);
    renderer._renderBlock(new Block([rule]), false);
    return renderer.model.render();
  }

  protected _render(sheet: Stylesheet): string {
    const { block } = sheet;
    if (block.charset) {
      this.model.value(this.ctx.render(block.charset));
    }
    this.env.push(sheet);
    this.renderImports(block);
    this._renderBlock(block, false);
    this.env.pop();
    return this.model.render();
  }

  protected _renderBlock(block: Block, includeImports: boolean): void {
    const { ctx, env, model } = this;
    for (const n of block.rules) {
      if (n === undefined) {
        continue;
      }
      switch (n.type) {
        case NodeType.BLOCK_DIRECTIVE:
        {
          const o = n as BlockDirective;
          env.push(o);
          model.push(NodeType.BLOCK_DIRECTIVE);
          model.header(o.name);
          this._renderBlock(o.block, true);
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
          model.value(ctx.render(n));
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

    this._renderBlock(r.block, true);
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

export const renderNode = (buf: Buffer, n: Node | undefined): void => {
  if (n === undefined) {
    return;
  }

  switch (n.type) {
    case NodeType.ALPHA:
      buf.str('alpha(opacity=');
      renderNode(buf, (n as Alpha).value);
      buf.str(')');
      break;

    case NodeType.ANONYMOUS:
    case NodeType.DIMENSION:
    case NodeType.FALSE:
    case NodeType.KEYWORD:
    case NodeType.PROPERTY:
    case NodeType.RATIO:
    case NodeType.TRUE:
    case NodeType.UNICODE_RANGE:
      n.repr(buf);
      break;

    case NodeType.ASSIGNMENT:
    {
      const o = n as Assignment;
      buf.str(o.name).str('=');
      renderNode(buf, o.value);
      break;
    }

    case NodeType.COLOR:
      (n as BaseColor).toRGB().repr(buf);
      break;

    case NodeType.COMMENT:
    {
      const o = n as Comment;
      if (o.block) {
        buf.str('/*').str(o.body).str('*/');
      } else {
        buf.str('//').str(o.body);
      }
      if (o.newline && !buf.compress) {
        buf.str('\n');
      }
      break;
    }

    case NodeType.DIRECTIVE:
    {
      const o = n as Directive;
      buf.str(o.name);
      if (o.value) {
        buf.str(' ');
        renderNode(buf, o.value);
      }
      break;
    }

    case NodeType.EXPRESSION:
      renderList(buf, (n as Expression).values, ' ');
      break;

    case NodeType.EXPRESSION_LIST:
      renderList(buf, (n as ExpressionList).values, buf.chars.listsep);
      break;

    case NodeType.FEATURE:
    {
      const o = n as Feature;
      renderNode(buf, o.property);
      buf.str(buf.chars.rulesep);
      renderNode(buf, o.value);
      break;
    }

    case NodeType.FEATURES:
      renderList(buf, (n as Features).features, buf.chars.listsep);
      break;

    case NodeType.FUNCTION_CALL:
    {
      const o = n as FunctionCall;
      buf.str(o.name).str('(');
      renderList(buf, o.args, buf.chars.listsep);
      buf.str(')');
      break;
    }

    case NodeType.PAREN:
      buf.str('(');
      renderNode(buf, (n as Paren).value);
      buf.str(')');
      break;

    case NodeType.QUOTED:
      renderQuoted(buf, n as Quoted);
      break;

    case NodeType.RULE:
    {
      const o = n as Rule;
      renderNode(buf, o.property);
      buf.str(buf.chars.rulesep);
      renderNode(buf, o.value);
      if (o.important) {
        buf.str(' !important');
      }
      break;
    }

    case NodeType.SELECTORS:
    {
      const selectors = (n as Selectors).selectors;
      for (const s of selectors) {
        renderSelector(buf, s);
      }
      break;
    }

    case NodeType.SELECTOR:
      renderSelector(buf, n as Selector);
      break;

    case NodeType.SHORTHAND:
    {
      const o = n as Shorthand;
      renderNode(buf, o.left);
      buf.str('/');
      renderNode(buf, o.right);
      break;
    }

    case NodeType.URL:
      buf.str('url(');
      renderNode(buf, (n as Url).value);
      buf.str(')');
      break;
  }
};

const renderList = (buf: Buffer, nodes: Node[], sep: string): void => {
  const len = nodes.length;
  for (let i = 0; i < len; i++) {
    if (i > 0) {
      buf.str(sep);
    }
    renderNode(buf, nodes[i]);
  }
};

const renderAlpha = (buf: Buffer, n: Alpha): void => {
  buf.str('alpha(opacity=');
  renderNode(buf, n.value);
  buf.str(')');
};

const renderQuoted = (buf: Buffer, n: Quoted): void => {
  const { escaped, parts } = n;
  const delim = escaped ? '' : n.delim;
  const emit = !buf.inEscape();
  if (emit) {
    if (!escaped) {
      buf.str(delim);
    }
    buf.startEscape(delim);
  }
  const len = parts.length;
  for (let i = 0; i < len; i++) {
    renderNode(buf, parts[i]);
  }

  if (emit) {
    buf.endEscape();
    if (!escaped) {
      buf.str(delim);
    }
  }
};

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

  if (elem instanceof AttributeElement) {
    buf.str('[');
    const { parts } = elem as AttributeElement;
    for (const part of parts) {
      renderNode(buf, part);
    }
    buf.str(']');

  } else if (elem instanceof TextElement) {
    (elem as TextElement).repr(buf);

  } else if (elem instanceof ValueElement) {
    renderNode(buf, (elem as ValueElement).value);
  }
};
