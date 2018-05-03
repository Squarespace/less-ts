import { Node } from '../common';
import {
  Alpha,
  Anonymous,
  Argument,
  Assignment,
  AttributeElement,
  Block,
  BlockDirective,
  Combinator,
  Comment,
  Condition,
  Definition,
  Dimension,
  Directive,
  Element,
  Expression,
  ExpressionList,
  FALSE,
  Feature,
  Features,
  FunctionCall,
  Guard,
  Import,
  Keyword,
  Media,
  Mixin,
  MixinCall,
  MixinCallArgs,
  MixinParams,
  Operation,
  Operator,
  Parameter,
  Paren,
  Property,
  Quoted,
  Ratio,
  RGBColor,
  Rule,
  Ruleset,
  Selector,
  Selectors,
  Shorthand,
  Stylesheet,
  TextElement,
  TRUE,
  Unit,
  UnicodeRange,
  Url,
  ValueElement,
  Variable,
} from '../model';

import {
  AlphaJ,
  AnonymousJ,
  ArgumentJ,
  AssignmentJ,
  AttrElementJ,
  BlockDirectiveJ,
  ColorJ,
  CommentJ,
  ConditionJ,
  DefinitionJ,
  DimensionJ,
  DirectiveJ,
  ExpressionJ,
  ExpressionListJ,
  FeatureJ,
  FeaturesJ,
  FunctionCallJ,
  GuardJ,
  ImportJ,
  JsonType,
  KeywordJ,
  MediaJ,
  MixinJ,
  MixinCallJ,
  MixinCallArgsJ,
  MixinParamsJ,
  NodeJ,
  OperationJ,
  ParameterJ,
  ParenJ,
  PropertyJ,
  QuotedJ,
  RatioJ,
  RuleJ,
  RulesetJ,
  SelectorJ,
  SelectorsJ,
  ShorthandJ,
  StylesheetJ,
  TextElementJ,
  UnicodeRangeJ,
  UrlJ,
  ValueElementJ,
  VariableJ,
} from './types';

/*
 * A parser will not be developed in this first pass. Instead we define a mapping from
 * JSON to LESS that is used to reconstruct the stylesheet. A server component will
 * deliver JSON to the browser and this class will build an executable tree.
 */

export class Builder {

  // TODO: encode source map info for looking up char/line and filename
  // This will create a string[] (produced by splitting on a delimiter) that
  // contains a list of Base64 VLQ. When an error occurs, a node's index value
  // is used to find the relevant VLQ which resolves the line/char offset and
  // optional file path. we only attach file paths to block-level nodes, so
  // the error handling function should know how to do that.

  // Appending char/line offsets and filename index to each node bloats the
  // JSON by roughly 2x, whereas using the implicit node index and vlq should
  // add only about 1.25 to 1.5x size, and the vlq would keep the offset info
  // out of the less instruction tree.

  // Also we plan to add a safe mode to this compiler which will report errors
  // in the console but not throw.

  // TODO: use this identifier to index into the line/char offset table
  private nodeId: number = 0;

  constructor(readonly table: string[]) {}

  expand(t: NodeJ): Node {

    // TODO: add nodeId to each node. this will be used to index into the vlq for
    // execution error reporting

    // TODO: note that tuple types are not automatically narrowed (yet) by the
    // Typescript compiler. For this reason you see a lot of casts to avoid
    // adding another intermediate "const x = y as Type" in some cases.
    // https://github.com/Microsoft/TypeScript/issues/23512

    switch (t[0]) {
      case JsonType.ALPHA:
      {
        const value = this.expand((t as AlphaJ)[1]);
        return new Alpha(value);
      }

      case JsonType.ANONYMOUS:
      {
        const value = this.table[(t as AnonymousJ)[1]];
        return new Anonymous(value);
      }

      case JsonType.ARGUMENT:
      {
        const name = this.table[(t as ArgumentJ)[1]];
        const value = this.expand((t as ArgumentJ)[2]);
        return new Argument(name, value);
      }

      case JsonType.ASSIGNMENT:
      {
        const name = this.table[(t as AssignmentJ)[1]];
        const value = this.expand((t as AssignmentJ)[2]);
        return new Assignment(name, value);
      }

      case JsonType.ATTR_ELEMENT:
      {
        const comb = this.table[(t as AttrElementJ)[1]] as Combinator;
        const segments = this.expandList((t as AttrElementJ)[2]);
        return new AttributeElement(comb, segments);
      }

      case JsonType.BLOCK_DIRECTIVE:
      {
        const name = this.table[(t as BlockDirectiveJ)[1]];
        const block = this.expandBlock((t as BlockDirectiveJ)[2]);
        return new BlockDirective(name, block);
      }

      case JsonType.COLOR:
      {
        const o = t as ColorJ;
        return new RGBColor(o[1], o[2], o[3], o[4]);
      }

      case JsonType.COMMENT:
      {
        const o = t as CommentJ;
        const body = this.table[o[1]];
        return new Comment(body, o[2], o[3] && true);
      }

      case JsonType.CONDITION:
      {
        const o = t as ConditionJ;
        const op = this.table[o[1]];
        const left = this.expand(o[2]);
        const right = this.expand(o[3]);
        return new Condition(op as Operator, left, right, o[4]);
      }

      case JsonType.DEFINITION:
      {
        const name = this.table[(t as DefinitionJ)[1]];
        const value = this.expand((t as DefinitionJ)[2]);
        return new Definition(name, value);
      }

      case JsonType.DIMENSION:
      {
        const unit = this.table[(t as DimensionJ)[2]];
        return new Dimension((t as DimensionJ)[1], unit as Unit);
      }

      case JsonType.DIRECTIVE:
      {
        const name = this.table[(t as DirectiveJ)[1]];
        const value = this.expand((t as DirectiveJ)[2]);
        return new Directive(name, value);
      }

      case JsonType.EXPRESSION:
      {
        const values = this.expandList((t as ExpressionJ)[1]);
        return new Expression(values);
      }

      case JsonType.EXPRESSION_LIST:
      {
        const values = this.expandList((t as ExpressionListJ)[1]);
        return new ExpressionList(values);
      }

      case JsonType.FALSE:
        return FALSE;

      case JsonType.FEATURE:
      {
        const property = this.expand((t as FeatureJ)[1]);
        const value = this.expand((t as FeatureJ)[2]);
        return new Feature(property, value);
      }

      case JsonType.FEATURES:
      {
        const features = this.expandList((t as FeaturesJ)[1]);
        return new Features(features);
      }

      case JsonType.FUNCTION_CALL:
      {
        const name = this.table[(t as FunctionCallJ)[1]];
        const args = this.expandList((t as FunctionCallJ)[2]);
        return new FunctionCall(name, args);
      }

      case JsonType.GUARD:
      {
        const conditions = this.expandList((t as GuardJ)[1]);
        return new Guard(conditions as Condition[]);
      }

      case JsonType.IMPORT:
      {
        const o = t as ImportJ;
        const path = this.expand(o[1]);
        const once = o[2];
        const features = this.expandNullable(o[3]) as Features;
        return new Import(path, once, features);
      }

      case JsonType.KEYWORD:
      {
        const value = this.table[(t as KeywordJ)[1]];
        return new Keyword(value);
      }

      case JsonType.MEDIA:
      {
        const features = this.expandNullable((t as MediaJ)[1]) as Features;
        const block = this.expandBlock((t as MediaJ)[2]);
        return new Media(features, block);
      }

      case JsonType.MIXIN:
      {
        const o = t as MixinJ;
        const name = this.table[o[1]];
        const params = this.expand(o[2]) as MixinParams;
        const guard = this.expandNullable(o[3]) as Guard;
        const block = this.expandBlock(o[4]);
        return new Mixin(name, params, guard, block);
      }

      case JsonType.MIXIN_ARGS:
      {
        const delim = (t as MixinCallArgsJ)[1] ? ',' : ';';
        const args = this.expandList((t as MixinCallArgsJ)[2]) as Argument[];
        return new MixinCallArgs(delim, args);
      }

      case JsonType.MIXIN_CALL:
      {
        const o = t as MixinCallJ;
        const selector = this.expand(o[1]) as Selector;
        const args = this.expand(o[2]) as MixinCallArgs;
        return new MixinCall(selector, args, o[3]);
      }

      case JsonType.MIXIN_PARAMS:
      {
        const o = t as MixinParamsJ;
        const params = this.expandList(o[1]) as Parameter[];
        return new MixinParams(params, o[2], o[3]);
      }

      case JsonType.OPERATION:
      {
        const o = t as OperationJ;
        const op = this.table[o[1]];
        const left = this.expand(o[2]);
        const right = this.expand(o[3]);
        return new Operation(op as Operator, left, right);
      }

      case JsonType.PARAMETER:
      {
        const o = t as ParameterJ;
        const name = this.table[o[1]];
        const value = this.expand(o[2]);
        return new Parameter(name, value, o[3]);
      }

      case JsonType.PAREN:
      {
        const value = this.expand((t as ParenJ)[1]);
        return new Paren(value);
      }

      case JsonType.PROPERTY:
      {
        const name = this.table[(t as PropertyJ)[1]];
        return new Property(name);
      }

      case JsonType.QUOTED:
      {
        const o = t as QuotedJ;
        const delim = o[1] ? '"' : "'";
        const segments = this.expandList(o[3]);
        return new Quoted(delim, o[2], segments);
      }

      case JsonType.RATIO:
      {
        const value = this.table[(t as RatioJ)[1]];
        return new Ratio(value);
      }

      case JsonType.RULE:
      {
        const o = t as RuleJ;
        const name = this.expand(o[1]);
        const value = this.expand(o[2]);
        return new Rule(name, value, o[3]);
      }

      case JsonType.RULESET:
      {
        const o = t as RulesetJ;
        const selectors = this.expand(o[1]) as Selectors;
        const block = this.expandBlock(o[2]);
        return new Ruleset(selectors, block);
      }

      case JsonType.SELECTOR:
      {
        const elements = this.expandList((t as SelectorJ)[1]) as Element[];
        return new Selector(elements);
      }

      case JsonType.SELECTORS:
      {
        const selectors = this.expandList((t as SelectorsJ)[1]) as Selector[];
        return new Selectors(selectors);
      }

      case JsonType.SHORTHAND:
      {
        const left = this.expand((t as ShorthandJ)[1]);
        const right = this.expand((t as ShorthandJ)[2]);
        return new Shorthand(left, right);
      }

      case JsonType.STYLESHEET:
      {
        // TODO: versioning support
        const block = this.expandBlock((t as StylesheetJ)[2]);
        return new Stylesheet(block);
      }

      case JsonType.TEXT_ELEMENT:
      {
        const comb = this.table[(t as TextElementJ)[1]] as Combinator;
        const name = this.table[(t as TextElementJ)[2]];
        return new TextElement(comb, name);
      }

      case JsonType.TRUE:
        return TRUE;

      case JsonType.UNICODE_RANGE:
      {
        const value = this.table[(t as UnicodeRangeJ)[1]];
        return new UnicodeRange(value);
      }

      case JsonType.URL:
      {
        const value = this.expand((t as UrlJ)[1]);
        return new Url(value);
      }

      case JsonType.VALUE_ELEMENT:
      {
        const comb = this.table[(t as ValueElementJ)[1]] as Combinator;
        const value = this.expand((t as ValueElementJ)[2]);
        return new ValueElement(comb, value);
      }

      case JsonType.VARIABLE:
      {
        const name = this.table[(t as VariableJ)[1]];
        return new Variable(name);
      }
    }
  }

  expandNullable(node: NodeJ): Node | undefined {
    return node[0] === -1 ? undefined : this.expand(node);
  }

  expandList(nodes: NodeJ[]): Node[] {
    const r: Node[] = [];
    for (const n of nodes) {
      r.push(this.expand(n));
    }
    return r;
  }

  /**
   * Append each node to the block, setting flags along the way.
   */
  expandBlock(nodes: NodeJ[]): Block {
    const block = new Block();
    for (const n of nodes) {
      block.add(this.expand(n));
    }
    return block;
  }
}
