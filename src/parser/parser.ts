import { Parselet, Parselets } from './stream';

import {
  AdditionParselet,
  AlphaParselet,
  AssignmentParselet,
  BlockParselet,
  ColorKeywordParselet,
  ColorParselet,
  CommentParselet,
  CommentRuleParselet,
  ConditionParselet,
  DimensionParselet,
  DirectiveParselet,
  ElementParselet,
  ExpressionListParselet,
  ExpressionParselet,
  FeaturesParselet,
  FeatureParselet,
  FontParselet,
  FunctionCallParselet,
  GuardParselet,
  JavascriptParselet,
  KeywordParselet,
  MixinCallArgsParselet,
  MixinCallParselet,
  MixinParamsParselet,
  MixinParselet,
  MultiplicationParselet,
  OperandParselet,
  PrimaryParselet,
  PropertyParselet,
  QuotedParselet,
  RatioParselet,
  RulesetParselet,
  RuleParselet,
  SelectorsParselet,
  SelectorParselet,
  ShorthandParselet,
  StylesheetParselet,
  SubParselet,
  UnicodeRangeParselet,
  UrlParselet,
  VariableCurlyParselet,
  VariableParselet
} from './parselets';

export const ALPHA: Parselet[] = [
  new AlphaParselet()
];

export const BLOCK: Parselet[] = [
  new BlockParselet()
];

export const COMMENT: Parselet[] = [
  new CommentParselet()
];

export const CONDITION: Parselet[] = [
  new ConditionParselet()
];

export const ELEMENT: Parselet[] = [
  new ElementParselet()
];

export const EXPRESSION: Parselet[] = [
  new ExpressionParselet()
];

export const EXPRESSION_LIST: Parselet[] = [
  new ExpressionListParselet()
];

export const FEATURE: Parselet[] = [
  new FeatureParselet()
];

export const FEATURES: Parselet[] = [
  new FeaturesParselet()
];

export const FONT: Parselet[] = [
  new FontParselet()
];

export const FUNCTION_CALL: Parselet[] = [
  new FunctionCallParselet()
];

export const GUARD: Parselet[] = [
  new GuardParselet()
];

export const KEYWORD: Parselet[] = [
  new KeywordParselet()
];

export const MIXIN: Parselet[] = [
  new MixinParselet()
];

export const MIXIN_CALL_ARGS: Parselet[] = [
  new MixinCallArgsParselet()
];

export const MIXIN_PARAMS: Parselet[] = [
  new MixinParamsParselet()
];

export const MULTIPLICATION: Parselet[] = [
  new MultiplicationParselet()
];

export const OPERAND: Parselet[] = [
  new OperandParselet()
];

export const PRIMARY: Parselet[] = [
  new PrimaryParselet()
];

export const PROPERTY: Parselet[] = [
  new PropertyParselet()
];

export const QUOTED: Parselet[] = [
  new QuotedParselet()
];

export const RULE: Parselet[] = [
  new RuleParselet()
];

export const RULESET: Parselet[] = [
  new RulesetParselet()
];

export const SELECTOR: Parselet[] = [
  new SelectorParselet()
];

export const SELECTORS: Parselet[] = [
  new SelectorsParselet()
];

export const STYLESHEET: Parselet[] = [
  new StylesheetParselet()
];

export const VARIABLE: Parselet[] = [
  new VariableParselet()
];

export const VARIABLE_CURLY: Parselet[] = [
  new VariableCurlyParselet()
];

// Composite parselets

export const ALPHA_SUB: Parselet[] = [
  new DimensionParselet(),
  new VariableParselet()
];

export const CONDITION_SUB: Parselet[] = [
  new AdditionParselet(),
  new KeywordParselet(),
  new QuotedParselet()
];

export const DIRECTIVE_IMPORT: Parselet[] = [
  new QuotedParselet(),
  new UrlParselet()
];

export const ELEMENT_SUB: Parselet[] = [
  new VariableCurlyParselet(),
  new VariableParselet(),
  new SelectorParselet()
];

export const LITERAL: Parselet[] = [
  new RatioParselet(),
  new DimensionParselet(),
  new ColorParselet(),
  new QuotedParselet(),
  new UnicodeRangeParselet()
];

export const ENTITY: Parselet[] = [
  ...LITERAL,
  new VariableParselet(),
  new FunctionCallParselet(),
  new KeywordParselet(),
  new JavascriptParselet(),
  new CommentParselet()
];

export const EXPRESSION_SUB: Parselet[] = [
  new CommentParselet(),
  new AdditionParselet(),
  ...ENTITY
];

export const FONT_SUB: Parselet[] = [
  new ShorthandParselet(),
  ...ENTITY
];

export const FUNCTION_CALL_ARGS: Parselet[] = [
  new AssignmentParselet(),
  ...EXPRESSION
];

export const FUNCTION_CALL_SUB: Parselet[] = [
  new QuotedParselet(),
  new VariableParselet()
];

export const MIXIN_PARAMETER: Parselet[] = [
  new VariableParselet(),
  ...LITERAL,
  new KeywordParselet()
];

export const OPERAND_SUB: Parselet[] = [
  new SubParselet(),
  new DimensionParselet(),
  new FunctionCallParselet(),
  new ColorKeywordParselet(),
  new ColorParselet(),
  new VariableParselet()
];

export const PRIMARY_SUB: Parselet[] = [
  new MixinParselet(),
  new RuleParselet(),
  new RulesetParselet(),
  new CommentRuleParselet(),
  new MixinCallParselet(),
  new DirectiveParselet()
];

export const RULE_KEY: Parselet[] = [
  new PropertyParselet(),
  new VariableParselet()
];

// Wire up parselets to static fields.

Parselets.ALPHA = ALPHA;
Parselets.ALPHA_SUB = ALPHA_SUB;
Parselets.BLOCK = BLOCK;
Parselets.COMMENT = COMMENT;
Parselets.CONDITION = CONDITION;
Parselets.CONDITION_SUB = CONDITION_SUB;
Parselets.DIRECTIVE_IMPORT = DIRECTIVE_IMPORT;
Parselets.ELEMENT = ELEMENT;
Parselets.ELEMENT_SUB = ELEMENT_SUB;
Parselets.ENTITY = ENTITY;
Parselets.EXPRESSION = EXPRESSION;
Parselets.EXPRESSION_LIST = EXPRESSION_LIST;
Parselets.EXPRESSION_SUB = EXPRESSION_SUB;
Parselets.FEATURE = FEATURE;
Parselets.FEATURES = FEATURES;
Parselets.FONT = FONT;
Parselets.FONT_SUB = FONT_SUB;
Parselets.FUNCTION_CALL_ARGS = FUNCTION_CALL_ARGS;
Parselets.FUNCTION_CALL_SUB = FUNCTION_CALL_SUB;
Parselets.GUARD = GUARD;
Parselets.KEYWORD = KEYWORD;
Parselets.MIXIN_CALL_ARGS = MIXIN_CALL_ARGS;
Parselets.MIXIN_PARAMETER = MIXIN_PARAMETER;
Parselets.MIXIN_PARAMS = MIXIN_PARAMS;
Parselets.MULTIPLICATION = MULTIPLICATION;
Parselets.OPERAND = OPERAND;
Parselets.OPERAND_SUB = OPERAND_SUB;
Parselets.PRIMARY = PRIMARY;
Parselets.PRIMARY_SUB = PRIMARY_SUB;
Parselets.PROPERTY = PROPERTY;
Parselets.QUOTED = QUOTED;
Parselets.RULE = RULE;
Parselets.RULESET = RULESET;
Parselets.RULE_KEY = RULE_KEY;
Parselets.SELECTOR = SELECTOR;
Parselets.SELECTORS = SELECTORS;
Parselets.VARIABLE = VARIABLE;
Parselets.VARIABLE_CURLY = VARIABLE_CURLY;
