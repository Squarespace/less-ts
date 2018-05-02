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
  Keyword,
  Media,
  Mixin,
  MixinCall,
  MixinCallArgs,
  MixinParams,
  Node,
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
 * Initially we are skipping the parser. Instead we define a mapping from JSON to LESS that
 * is used to reconstruct the stylesheet. A server component will deliver JSON to the
 * browser and this class will build an executable tree.
 */

export class Builder {

  constructor(readonly table: string[]) {}

  expand(t: NodeJ): Node {
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
        const o = t as ArgumentJ;
        const name = this.table[o[1]];
        const value = this.expand(o[2]);
        return new Argument(name, value);
      }

      case JsonType.ASSIGNMENT:
      {
        const o = t as AssignmentJ;
        const name = this.table[o[1]];
        const value = this.expand(o[2]);
        return new Assignment(name, value);
      }

      case JsonType.ATTR_ELEMENT:
      {
        const o = t as AttrElementJ;
        const comb = this.table[o[1]] as Combinator;
        const segments = this.expandList(o[2]);
        return new AttributeElement(comb, segments);
      }

      case JsonType.BLOCK_DIRECTIVE:
      {
        const o = t as BlockDirectiveJ;
        const name = this.table[o[1]];
        const nodes = this.expandList(o[2]);
        const block = new Block(nodes);
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
        const o = t as DefinitionJ;
        const name = this.table[o[1]];
        const value = this.expand(o[2]);
        return new Definition(name, value);
      }

      case JsonType.DIMENSION:
      {
        const o = t as DimensionJ;
        const unit = this.table[o[2]];
        return new Dimension(o[1], unit as Unit);
      }

      case JsonType.DIRECTIVE:
      {
        const o = t as DirectiveJ;
        const name = this.table[o[1]];
        const value = this.expand(o[2]);
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
        const o = t as FeatureJ;
        const property = this.expand(o[1]);
        const value = this.expand(o[2]);
        return new Feature(property, value);
      }

      case JsonType.FEATURES:
      {
        const features = this.expandList((t as FeaturesJ)[1]);
        return new Features(features);
      }

      case JsonType.FUNCTION_CALL:
      {
        const o = t as FunctionCallJ;
        const name = this.table[o[1]];
        const args = this.expandList(o[2]);
        return new FunctionCall(name, args);
      }

      case JsonType.GUARD:
      {
        const conditions = this.expandList((t as GuardJ)[1]);
        return new Guard(conditions as Condition[]);
      }

      case JsonType.KEYWORD:
      {
        const value = this.table[(t as KeywordJ)[1]];
        return new Keyword(value);
      }

      case JsonType.MEDIA:
      {
        const o = t as MediaJ;
        const features = this.expandList(o[1]);
        const rules = this.expandList(o[2]);
        return new Media(new Features(features), new Block(rules));
      }

      case JsonType.MIXIN:
      {
        const o = t as MixinJ;
        const name = this.table[o[1]];
        const params = this.expand(o[2]) as MixinParams;
        const guard = this.expand(o[3]) as Guard;
        const rules = this.expandList(o[4]);
        return new Mixin(name, params, guard, new Block(rules));
      }

      case JsonType.MIXIN_ARGS:
      {
        const o = t as MixinCallArgsJ;
        const delim = o[1] ? ',' : ';';
        const args = this.expandList(o[2]) as Argument[];
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
        const delim = o[1] ? "'" : '"';
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
        const rules = this.expandList(o[2]);
        return new Ruleset(selectors, new Block(rules));
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
        const o = t as ShorthandJ;
        const left = this.expand(o[1]);
        const right = this.expand(o[2]);
        return new Shorthand(left, right);
      }

      case JsonType.STYLESHEET:
      {
        // TODO: versioning support
        const rules = this.expandList((t as StylesheetJ)[2]);
        return new Stylesheet(new Block(rules));
      }

      case JsonType.TEXT_ELEMENT:
      {
        const o = t as TextElementJ;
        const comb = this.table[o[1]] as Combinator;
        const name = this.table[o[2]];
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
        const o = t as ValueElementJ;
        const comb = this.table[o[1]] as Combinator;
        const value = this.expand(o[2]);
        return new ValueElement(comb, value);
      }

      case JsonType.VARIABLE:
      {
        const name = this.table[(t as VariableJ)[1]];
        return new Variable(name);
      }
    }
  }

  expandList(nodes: NodeJ[]): Node[] {
    const r: Node[] = [];
    for (const n of nodes) {
      r.push(this.expand(n));
    }
    return r;
  }

}
