/**
 * Map a JSON array type to a model object's constructor.
 * These values must be kept in sync 1:1 with the Java implementation.
 */
export const enum JsonType {
  ALPHA = 0,
  ANONYMOUS = 1,
  ARGUMENT = 2,
  ASSIGNMENT = 3,
  ATTR_ELEMENT = 4,
  BLOCK_DIRECTIVE = 5,
  COLOR = 6,
  COMMENT = 7,
  CONDITION = 8,
  DEFINITION = 9,
  DIMENSION = 10,
  DIRECTIVE = 11,
  EXPRESSION = 12,
  EXPRESSION_LIST = 13,
  FALSE = 14,
  FEATURE = 15,
  FEATURES = 16,
  FUNCTION_CALL = 17,
  GUARD = 18,
  IMPORT = 19,
  KEYWORD = 20,
  MEDIA = 21,
  MIXIN = 22,
  MIXIN_ARGS = 23,
  MIXIN_CALL = 24,
  MIXIN_PARAMS = 25,
  OPERATION = 26,
  PARAMETER = 27,
  PAREN = 28,
  PROPERTY = 29,
  QUOTED = 30,
  RATIO = 31,
  RULE = 32,
  RULESET = 33,
  SELECTOR = 34,
  SELECTORS = 35,
  SHORTHAND = 36,
  STYLESHEET = 37,
  TEXT_ELEMENT = 38,
  TRUE = 39,
  UNICODE_RANGE = 40,
  URL = 41,
  VALUE_ELEMENT = 42,
  VARIABLE = 43
}

export type NodeJ =
  | AlphaJ
  | AnonymousJ
  | ArgumentJ
  | AssignmentJ
  | AttrElementJ
  | BlockDirectiveJ
  | ColorJ
  | CommentJ
  | ConditionJ
  | DefinitionJ
  | DimensionJ
  | DirectiveJ
  | ExpressionJ
  | ExpressionListJ
  | FalseJ
  | FeatureJ
  | FeaturesJ
  | FunctionCallJ
  | GuardJ
  | ImportJ
  | KeywordJ
  | MediaJ
  | MixinJ
  | MixinCallJ
  | MixinCallArgsJ
  | MixinParamsJ
  | OperationJ
  | ParameterJ
  | ParenJ
  | PropertyJ
  | QuotedJ
  | RatioJ
  | RuleJ
  | RulesetJ
  | SelectorJ
  | SelectorsJ
  | ShorthandJ
  | StylesheetJ
  | TextElementJ
  | TrueJ
  | UnicodeRangeJ
  | UrlJ
  | ValueElementJ
  | VariableJ
  ;

/**
 * Each type in the JSON syntax is an array whose first element is
 * the node type. All strings are represented by a numeric offset into
 * a shared string table.
 */

export interface AlphaJ {
  [0]: JsonType.ALPHA;
  // value
  [1]: NodeJ;
}

export interface AnonymousJ {
  [0]: JsonType.ANONYMOUS;
  // value index
  [1]: number;
}

export interface ArgumentJ {
  [0]: JsonType.ARGUMENT;
  // name index
  [1]: number;
  // value
  [2]: NodeJ;
}

export interface AssignmentJ {
  [0]: JsonType.ASSIGNMENT;
  // name index
  [1]: number;
  // value
  [2]: NodeJ;
}

export interface AttrElementJ {
  [0]: JsonType.ATTR_ELEMENT;
  // combinator index
  [1]: number;
  // element segments
  [2]: NodeJ[];
}

export interface BlockDirectiveJ {
  [0]: JsonType.BLOCK_DIRECTIVE;
  // name index
  [1]: number;
  // block
  [2]: NodeJ[];
}

export interface ColorJ {
  [0]: JsonType.COLOR;
  // red
  [1]: number;
  // green
  [2]: number;
  // blue
  [3]: number;
  // alpha
  [4]: number;
  // optional keyword
  [5]: number;
}

export interface CommentJ {
  [0]: JsonType.COMMENT;
  // body index
  [1]: number;
  // style  0 = line  1 = block
  [2]: number;
  // add newline boolean
  [3]: number;
}

export interface ConditionJ {
  [0]: JsonType.CONDITION;
  // operator index
  [1]: number;
  // left value
  [2]: NodeJ;
  // right value
  [3]: NodeJ;
  // negate
  [4]: number;
}

export interface DefinitionJ {
  [0]: JsonType.DEFINITION;
  // name index
  [1]: number;
  // value
  [2]: NodeJ;
}

export interface DimensionJ {
  [0]: JsonType.DIMENSION;
  // value
  [1]: number;
  // unit index
  [2]: number;
}

export interface DirectiveJ {
  [0]: JsonType.DIRECTIVE;
  // name index
  [1]: number;
  // value
  [2]: NodeJ;
}

export interface ExpressionJ {
  [0]: JsonType.EXPRESSION;
  // values
  [1]: NodeJ[];
}

export interface ExpressionListJ {
  [0]: JsonType.EXPRESSION_LIST;
  // values
  [1]: NodeJ[];
}

export interface FalseJ {
  [0]: JsonType.FALSE;
}

export interface FeatureJ {
  [0]: JsonType.FEATURE;
  // property
  [1]: NodeJ;
  // value
  [2]: NodeJ;
}

export interface FeaturesJ {
  [0]: JsonType.FEATURES;
  // values
  [1]: NodeJ[];
}

export interface FunctionCallJ {
  [0]: JsonType.FUNCTION_CALL;
  // name index
  [1]: number;
  // arguments
  [2]: NodeJ[];
}

export interface GuardJ {
  [0]: JsonType.GUARD;
  // conditions
  [1]: NodeJ[];
}

export interface ImportJ {
  [0]: JsonType.IMPORT;
  // path
  [1]: NodeJ;
  // once boolean
  [2]: number;
  // features (nullable)
  [3]: NodeJ;
}

export interface KeywordJ {
  [0]: JsonType.KEYWORD;
  // value index
  [1]: number;
}

export interface MediaJ {
  [0]: JsonType.MEDIA;
  // features (nullable)
  [1]: NodeJ;
  // block
  [2]: NodeJ[];
}

export interface MixinJ {
  [0]: JsonType.MIXIN;
  // name index
  [1]: number;
  // parameters
  [2]: NodeJ;
  // guard
  [3]: NodeJ;
  // block
  [4]: NodeJ[];
}

export interface MixinCallJ {
  [0]: JsonType.MIXIN_CALL;
  // selector
  [1]: NodeJ;
  // arguments
  [2]: NodeJ;
  // important
  [3]: number;
}

export interface MixinCallArgsJ {
  [0]: JsonType.MIXIN_ARGS;
  // delimiter type
  [1]: number;
  // arguments
  [2]: NodeJ[];
}

export interface MixinParamsJ {
  [0]: JsonType.MIXIN_PARAMS;
  // parameters
  [1]: NodeJ[];
}

export interface OperationJ {
  [0]: JsonType.OPERATION;
  // operator index
  [1]: number;
  // left value
  [2]: NodeJ;
  // right value
  [3]: NodeJ;
}

export interface ParameterJ {
  [0]: JsonType.PARAMETER;
  // name index
  [1]: number;
  // value
  [2]: NodeJ;
  // variadic boolean
  [3]: number;
}

export interface ParenJ {
  [0]: JsonType.PAREN;
  // value
  [1]: NodeJ;
}

export interface PropertyJ {
  [0]: JsonType.PROPERTY;
  // name index
  [1]: number;
}

export interface QuotedJ {
  [0]: JsonType.QUOTED;
  // delim type. 0 = single  1 = double
  [1]: number;
  // escaped boolean
  [2]: number;
  // segments
  [3]: NodeJ[];
}

export interface RatioJ {
  [0]: JsonType.RATIO;
  // value index
  [1]: number;
}

export interface RuleJ {
  [0]: JsonType.RULE;
  // property
  [1]: NodeJ;
  // value
  [2]: NodeJ;
  // important boolean
  [3]: number;
}

export interface RulesetJ {
  [0]: JsonType.RULESET;
  // selectors
  [1]: NodeJ;
  // rules
  [2]: NodeJ[];
}

export interface SelectorJ {
  [0]: JsonType.SELECTOR;
  // elements
  [1]: NodeJ[];
}

export interface SelectorsJ {
  [0]: JsonType.SELECTORS;
  // selectors
  [1]: NodeJ[];
}

export interface ShorthandJ {
  [0]: JsonType.SHORTHAND;
  // left value
  [1]: NodeJ;
  // right value
  [2]: NodeJ;
}

export interface StylesheetJ {
  [0]: JsonType.STYLESHEET;
  // version number
  [1]: number;
  // rules
  [2]: NodeJ[];
}

export interface TextElementJ {
  [0]: JsonType.TEXT_ELEMENT;
  // combinator
  [1]: number;
  // value index
  [2]: number;
}

export interface TrueJ {
  [0]: JsonType.TRUE;
}

export interface UnicodeRangeJ {
  [0]: JsonType.UNICODE_RANGE;
  // value index
  [1]: number;
}

export interface UrlJ {
  [0]: JsonType.URL;
  // value
  [1]: NodeJ;
}

export interface ValueElementJ {
  [0]: JsonType.VALUE_ELEMENT;
  // combinator
  [1]: number;
  // value
  [2]: NodeJ;
}

export interface VariableJ {
  [0]: JsonType.VARIABLE;
  // name index
  [1]: number;
  // indirect
  [2]: number;
  // curly
  [3]: number;
}
