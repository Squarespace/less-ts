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

/**
 * Base for all nodes.
 */
export abstract class Node {

  constructor(readonly type: NodeType) {}

  /**
   * Append this node's representation to the buffer.
   */
  abstract repr(buf: Buffer): void;

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

}

/**
 * Definition interface, forward reference.
 */
export interface IDefinition {
  dereference(env: ExecEnv): Node;
}

export interface Context {

  readonly indentSize: number;
  readonly compress: boolean;
  readonly fastcolor: boolean;
  readonly spacer: string;

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
}

export interface Chars {
  listsep: string;
  rulesep: string;
  ruleend: string;
  selectorsep: string;
}

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
  chars: Chars;

  /**
   * Append a string to the buffer.
   */
  str(s: string): Buffer;

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
