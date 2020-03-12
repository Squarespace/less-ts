/**
 * Types of node in the LESS syntax.
 */
export const enum NodeType {
  ALPHA,
  ANONYMOUS,
  ARGUMENT,
  ASSIGNMENT,
  BLOCK,
  BLOCK_DIRECTIVE,
  COLOR,
  COMMENT,
  CONDITION,
  DEFINITION,
  DIMENSION,
  DIRECTIVE,
  ELEMENT,
  EXPRESSION,
  EXPRESSION_LIST,
  FALSE,
  FEATURE,
  FEATURES,
  FUNCTION_CALL,
  GENERIC_BLOCK,
  GUARD,
  IMPORT,
  IMPORT_MARKER,
  KEYWORD,
  MEDIA,
  MIXIN,
  MIXIN_ARGS,
  MIXIN_CALL,
  MIXIN_MARKER,
  MIXIN_PARAMS,
  OPERATION,
  PARAMETER,
  PAREN,
  PARSE_ERROR,
  PROPERTY,
  QUOTED,
  RATIO,
  RULE,
  RULESET,
  SELECTOR,
  SELECTORS,
  SHORTHAND,
  STYLESHEET,
  TRUE,
  UNICODE_RANGE,
  URL,
  VARIABLE
}

export const NodeName: { [x: number]: string } = {
  [NodeType.ALPHA]: 'ALPHA',
  [NodeType.ANONYMOUS]: 'ANONYMOUS',
  [NodeType.ARGUMENT]: 'ARGUMENT',
  [NodeType.ASSIGNMENT]: 'ASSIGNMENT',
  [NodeType.BLOCK]: 'BLOCK',
  [NodeType.BLOCK_DIRECTIVE]: 'BLOCK_DIRECTIVE',
  [NodeType.COLOR]: 'COLOR',
  [NodeType.COMMENT]: 'COMMENT',
  [NodeType.CONDITION]: 'CONDITION',
  [NodeType.DEFINITION]: 'DEFINITION',
  [NodeType.DIMENSION]: 'DIMENSION',
  [NodeType.DIRECTIVE]: 'DIRECTIVE',
  [NodeType.ELEMENT]: 'ELEMENT',
  [NodeType.EXPRESSION]: 'EXPRESSION',
  [NodeType.EXPRESSION_LIST]: 'EXPRESSION_LIST',
  [NodeType.FALSE]: 'FALSE',
  [NodeType.FEATURE]: 'FEATURE',
  [NodeType.FEATURES]: 'FEATURES',
  [NodeType.FUNCTION_CALL]: 'FUNCTION_CALL',
  [NodeType.GENERIC_BLOCK]: 'GENERIC_BLOCK',
  [NodeType.GUARD]: 'GUARD',
  [NodeType.IMPORT]: 'IMPORT',
  [NodeType.IMPORT_MARKER]: 'IMPORT_MARKER',
  [NodeType.KEYWORD]: 'KEYWORD',
  [NodeType.MEDIA]: 'MEDIA',
  [NodeType.MIXIN]: 'MIXIN',
  [NodeType.MIXIN_ARGS]: 'MIXIN_ARGS',
  [NodeType.MIXIN_CALL]: 'MIXIN_CALL',
  [NodeType.MIXIN_MARKER]: 'MIXIN_MARKER',
  [NodeType.MIXIN_PARAMS]: 'MIXIN_PARAMS',
  [NodeType.OPERATION]: 'OPERATION',
  [NodeType.PARAMETER]: 'PARAMETER',
  [NodeType.PAREN]: 'PAREN',
  [NodeType.PARSE_ERROR]: 'PARSE_ERROR',
  [NodeType.PROPERTY]: 'PROPERTY',
  [NodeType.QUOTED]: 'QUOTED',
  [NodeType.RATIO]: 'RATIO',
  [NodeType.RULE]: 'RULE',
  [NodeType.RULESET]: 'RULESET',
  [NodeType.SELECTOR]: 'SELECTOR',
  [NodeType.SELECTORS]: 'SELECTORS',
  [NodeType.SHORTHAND]: 'SHORTHAND',
  [NodeType.STYLESHEET]: 'STYLESHEET',
  [NodeType.TRUE]: 'TRUE',
  [NodeType.UNICODE_RANGE]: 'UNICODE_RANGE',
  [NodeType.URL]: 'URL',
  [NodeType.VARIABLE]: 'VARIABLE'
};

export const NodeTypes = Object.keys(NodeName).map(Number).reduce((p, c) => {
  const v = NodeName[c];
  p[v] = c;
  return p;
}, {} as { [x: string]: number });

export type LessErrorType = 'runtime';

export interface LessError {

  type: LessErrorType;

  message: string;
}

// TODO: record node that raised the error (rule level and up) and
// attach the context. we can snapshot the stack when an error
// occurs, and sort things out when the error messages are rendered.

export interface LessErrorEvent {
  // Error messages
  errors: LessError[];

  // Node where the error was raised
  node: Node;

  // Block nodes showing context in which the error occurred.
  stack: IBlockNode[];
}

/**
 * Base for all nodes.
 */
export abstract class Node {

  constructor(readonly type: NodeType) { }

  /**
   * Append this node's representation to the buffer.
   */
  abstract repr(buf: Buffer): void;

  abstract equals(n: Node): boolean;

  /**
   * Indicates if this node requires evaluation. Used to short-circuit
   * and avoid unnecessary copying.
   */
  needsEval(): boolean {
    return false;
  }

  /**
   * Evaluate and return a new node of the same type.
   */
  eval(env: ExecEnv): Node {
    return this;
  }

}

/**
 * BlockNode interface, forward reference.
 */
export interface IBlockNode {

  /**
   * Block containing the rules attached to this block node.
   */
  readonly block: IBlock;

}

export interface IBlock {

  readonly rules: Node[];

  mixins?: Map<string, Node[]>;

  dump(buf: Buffer): void;

  /**
    * Lookup the definition 'name'
    */
  resolveDefinition(name: string): IDefinition | undefined;
}

/**
 * Definition interface, forward reference.
 */
export interface IDefinition {
  dereference(env: ExecEnv): Node;
}

export type NodeRenderer = (buf: Buffer, n: Node) => void;

export interface Context {

  readonly indentSize: number;
  readonly compress: boolean;
  readonly fastcolor: boolean;
  readonly spacer: string;
  readonly nocache: boolean;
  readonly chars: Separators;
  mixinDepth: number;
  mixinRecursionLimit: number;

  readonly renderer: NodeRenderer;
  readonly errors: LessErrorEvent[];

  /**
   * Capture all errors on the given execution environment.
   */
  captureErrors(node: Node, env: ExecEnv): void;

  /**
   * Construct a new buffer.
   */
  newBuffer(): Buffer;

  /**
   * Construct a new execution environment.
   */
  newEnv(): ExecEnv;

  /**
   * Render a node to string using a temporary buffer.
   */
  render(node: Node): string;

  /**
   * Render a node into the given buffer.
   */
  renderInto(buf: Buffer, node: Node): void;

  /**
   * Find a function implementation with the given name.
   */
  findFunction(name: string): Function | undefined;
}

/**
 * Execution environment exposed to nodes for evaluation
 */
export interface ExecEnv {

  /**
   * Access to the context for this execution environment.
   */
  ctx: Context;

  /**
   * Stack frames.
   */
  frames: IBlockNode[];

  errors: LessError[];

  dump(): string;

  /**
   * Create a copy of this environment for some temporary evals.
   */
  copy(): ExecEnv;

  append(frames: IBlockNode[]): void;

  /**
   * Lookup the definition 'name'
   */
  resolveDefinition(name: string): IDefinition | undefined;

  /**
   * Push a block node onto the stack.
   */
  push(node: IBlockNode): void;

  /**
   * Pop a block node off the stack.
   */
  pop(): void;

  /**
   * Render a (non-block) node into a string.
   */
  render(node: Node): string;
}

/**
 * Options controlling evaluation and rendering.
 */
export interface Options {
  // Number of spaces of indent. Ignored when compress=true
  readonly indentSize?: number;

  // Emit CSS with whitespace compressed
  readonly compress?: boolean;

  // Emit colors in fast hex, skip attempting to resolve a color
  // back to its keyword
  readonly fastcolor?: boolean;

  // Enable strict math mode
  readonly strictMath?: boolean;

  // Disable internal caches
  readonly nocache?: boolean;

  // Maximum depth of mixin recursion
  readonly mixinRecursionLimit?: number;
}

export interface Separators {
  listsep: string;
  rulesep: string;
  ruleend: string;
  selectorsep: string;
}

export const EOF: string = '\0';

/**
 * Buffer used for node rendering.
 */
export interface Buffer extends Options {

  /**
   * Character at the end of the buffer.
   */
  prev: string;

  /**
   * Frequently-used character sequences.
   */
  chars: Separators;

  /**
   * Currently-active string delimiter, or EOF.
   */
  delim: string;

  /**
   * Number of decimal points for fractional values.
   */
  numericScale?: number;

  /**
   * Append a string to the buffer.
   */
  str(s: string): Buffer;

  /**
   * Indicates the buffer is in escape mode.
   */
  inEscape(): boolean;

  /**
   * Enter quoted escape mode with the given delimiter.
   */
  startEscape(delim: string): void;

  /**
   * Exit quoted escape mode.
   */
  endEscape(): void;

  /**
   * Append a number to the buffer.
   */
  num(n: number): Buffer;

  /**
   * Indent N spaces.
   */
  indent(): Buffer;

  /**
   * Increase indent level.
   */
  incr(): void;

  /**
   * Decrease indent level.
   */
  decr(): void;

  /**
   * Clear the buffer for reuse.
   */
  reset(): void;

  /**
   * Open a nested block.
   */
  blockOpen(): void;

  /**
   * Close a nested block.
   */
  blockClose(): void;
}

/**
 * A plugin function callable by a FunctionCall node.
 */
export interface Function {

  /**
   * Validate the arguments to the function and return any errors that occur.
   */
  validate(env: ExecEnv, args: Node[]): [boolean, LessError[]];

  /**
   * Call the function with the given arguments and return the result.
   */
  invoke(env: ExecEnv, args: Node[]): Node | undefined;
}
