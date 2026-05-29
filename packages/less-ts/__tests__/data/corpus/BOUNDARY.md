# Corpus v2 - Java main behavior boundary map (PINNED)

Pinned 2026-08-31 against Java `less-compiler` main @ 45a099c (1.7.2
released surface + version bump), default `LessOptions()`. Regenerate with
`tools/JavaReferenceProbe.java` (see README.md).

Byte-exact reference outputs: `java-main/<name>.css` (OK) and
`java-main/<name>.err` (verbatim `LessException.getMessage()`, no trailing
newline). TS-current outputs for contrast: `ts-current/` (regenerable;
never the source of truth).

## 1. The boundary statement (what Java main does)

Function calls in the generic sense (`lighten`, `round`, `unit`, `calc`,
`rgb`, ...) parse **everywhere** as a `FUNCTION_CALL` node. They are
**never evaluated**. What varies by position is the failure mode of the
unwrap:

| Position | Leaf fn call | fn call in operation | fn call in guard compare |
|---|---|---|---|
| property value | renders literally | ERR INVALID_OPERATION2 | n/a |
| definition | held literally | ERR INVALID_OPERATION2 | n/a |
| mixin call arg | passed literally | ERR INVALID_OPERATION2 | n/a |
| mixin def default | literal default | n/a | n/a |
| media feature | renders literally | n/a | n/a |
| guard condition | n/a | n/a | ERR UNCOMPARABLE_TYPE |

Two constructs are NOT generic calls and DO evaluate as leaves:

- `calc(...)`: arithmetic inside runs; incompatible units strip with an
  INCOMPATIBLE_UNITS warning comment **embedded in the css**. In an
  operation, calc is a plain FUNCTION_CALL -> ERR INVALID_OPERATION2.
- `rgba()` / `hsla()`: constructors become color nodes (alpha compresses
  like any color). `rgb()` / `hsl()` are generic calls (literal). In an
  operation, same FUNCTION_CALL failure.

Literal rendering still substitutes variables in the args: `lighten(@c,
10%)` with `@c: #000` renders `lighten(#000, 10%)`. Nested generic calls
render as one literal. A generic call wrapping calc renders with the calc
arg EVALUATED: `unit(calc(100% - 90%))` -> `unit(calc(10%))`.

Errors abort the whole compile (LessException). Messages are verbatim in
the `.err` files; shapes: `ExecuteError <TYPE>: <message>` and
`SyntaxError INCOMPLETE_PARSE Unable to complete parse.`

## 2. Fixture matrix (50 fixtures, 32 OK / 18 ERR)

### 010-019: property values (fn calls in VALUE position)

| Fixture | Java main | TS today |
|---|---|---|
| 010 `lighten(#000, 10%)` | literal `lighten(#000, 10%)` | evaluates `#1a1a1a` |
| 011 `round(4.6px)` | literal | `5px` |
| 012 `calc(100% - 10px)` | `calc(90%)` + WARNING[1] comment | `calc(90%)`, no comment |
| 013 `lighten(lighten(...), 20%)` | literal (whole) | eval `#4d4d4d` |
| 014 `lighten(@c, 10%)` | literal, `@c` SUBSTITUTED | eval `#1a1a1a` |
| 015 `(lighten(#000, 10%))` | literal (parens no-op) | eval `#1a1a1a` |
| 016 `lighten(...) + 1`, `1 + unit(5px)` | ERR INVALID_OPERATION2 | eval `#1b1b1b`, `6` |
| 017 `unit(calc(100% - 90%))` | literal `unit(calc(10%))` - calc arg evaluated | ERR (unit arg must be dimension) |
| 018 `calc(100% - unit(5px))` | ERR INVALID_OPERATION1 | eval `calc(95%)` |

### 020-025: definitions

| Fixture | Java main | TS today |
|---|---|---|
| 020 `@x: lighten(#000, 10%)`; use | literal | eval `#1a1a1a` |
| 021 `@x: round(4.6px)`; use | literal | `5px` |
| 022 `@w: calc(...)`; use | `calc(90%)`, warning at definition | `calc(90%)`, no comment |
| 023 nested lighten in def | literal | eval |
| 024 `@x: lighten(...) + 10` | ERR INVALID_OPERATION2 | eval `#242424` |
| 025 `@x: (lighten(...))` | literal | eval |

### 030-036: mixin call args and def defaults

| Fixture | Java main | TS today |
|---|---|---|
| 030 arg fn | literal | eval |
| 031 nested arg fn | literal | eval |
| 032 arg round | literal | `5px` |
| 033 arg calc | `calc(90%)` + warning | `calc(90%)`, no comment |
| 034 arg fn + op | ERR INVALID_OPERATION2 | eval |
| 035 `(())` arg full parens | literal | eval |
| 036 default `@c: lighten(...)` | literal default | eval |

### 040-045: guard conditions (the guard boundary)

| Fixture | Java main | TS today |
|---|---|---|
| 040 `when (unit(10px) = 10)` | ERR UNCOMPARABLE_TYPE | OK `a: ok` (evaluates) |
| 041 `when (round(@x) = 5)` | ERR UNCOMPARABLE_TYPE | OK `a: ok` |
| 042 `@x: round(4.6)`; `when (@x = 5)` | ERR UNCOMPARABLE_TYPE (def holds raw call) | OK `a: ok` |
| 043 `when (lighten(...) >= #000)` | ERR UNCOMPARABLE_TYPE | OK, empty output (guard false) |
| 044 `when (unit(calc(100% - 90%)) = 10)` | ERR UNCOMPARABLE_TYPE | ERR (unit arg) |
| 045 `when (unit(@x) = 10)` | ERR UNCOMPARABLE_TYPE | OK `a: ok` |

Plain numeric guards (`@x = 5`, scratch g3) still work byte-identical.

### 050-053: media features

| Fixture | Java main | TS today |
|---|---|---|
| 050 `(min-width: round(4.6px))` | literal | `5px` (evaluates) |
| 051 `(min-width: lighten(...))` | literal | `#1a1a1a` |
| 052 `(min-width: calc(...))` | `calc(90%)` + warning | `calc(90%)`, no comment |
| 053 `@w: round(4.6px)`; `(min-width: @w)` | literal | `5px` |

### 210-213: colors

| Fixture | Java main | TS today |
|---|---|---|
| 210 keywords red/blue/rebeccapurple | passthrough | hex except rebeccapurple |
| 211 `#aabbcc` `#abc` `#11223344` | `#abc` `#abc` `#123 44` | `#aabbcc` `#aabbcc` `#112233 44` |
| 212 `@c: red`; use | `red` passthrough | `#ff0000` |
| 213 `rgba(255,0,0,0.5)` `hsla(0,100%,50%,0.25)` | `rgba(255, 0, 0, .5)` `hsla(0, 100%, 50%, .25)` | same rgba; hsla -> rgba |

### 220: full fn set in values (all literal on Java)

`lighten darken mod round unit convert sqrt length extract fade mix
saturate` - all literal; TS evaluates all to computed values.

### 230-234: color math

| Fixture | Java main | TS today |
|---|---|---|
| 230 `#808080 / 3` | `#2a2a2a` (truncate) | `#2b2b2b` (round) |
| 231 `#fff * 0.5` | `#000` (frac scalar -> 0) | `#ffffff` (neither side!) |
| 232 `#808080 * 2`, `+`, `#010203 * 3` | `#fff`, `#fff`, `#030609` (clamp 255, int math) | same |
| 233 `rgba(0,0,0,0.5) * 2` | ERR INVALID_OPERATION2 (ctor = FUNCTION_CALL in op) | eval `#000000` |
| 234 `rgba + rgba` | ERR INVALID_OPERATION2 | eval |

### 310-321: errors (messages verbatim in `.err` files)

| Fixture | Java main message (verbatim) | TS today |
|---|---|---|
| 310 `(1 / 0)` | `ExecuteError DIVIDE_BY_ZERO: Attempt to divide DIMENSION 1.0 by zero.` | `Error: Attempt to divide 1 by zero:` + context |
| 311 `.nope()` | `ExecuteError MIXIN_UNDEFINED: Failed to locate a mixin using selector .nope` | same text, `Error:` prefix + context |
| 312 `x: @nope` | `ExecuteError VAR_UNDEFINED: Failed to locate a definition for the variable @nope in current scope` | same text + prefix/context |
| 313 `@nope + 1px` | same as 312 | same as 312 |
| 315 `.m(1px, 2px)` vs 1-arg def | `ExecuteError MIXIN_UNDEFINED: Failed to locate a mixin using selector .m` | same text + prefix/context |
| 321 `.a { .; }` | `SyntaxError INCOMPLETE_PARSE Unable to complete parse.` | same + `SyntaxError:` colon + Line/Statement block |

OK on both: 314 guard duplicates apply twice; 320 empty value `x: ;`
renders as-is.

## 3. Divergence summary vs TS today

- TS evaluates every generic fn call in every position (the "fixed" side
  of the Java FUNCTION_CALL_IN_VALUE question); Java main never does.
- Java hard-errors (INVALID_OPERATION2 / UNCOMPARABLE_TYPE) where TS
  evaluates or partially evaluates - TS has no error path for these cells.
- calc and rgba/hsla eval on both runtimes for the leaf cases; TS lacks
  the embedded INCOMPATIBLE_UNITS warning comments.
- keywords/hex compression/8-digit-alpha split; truncation +
  fractional scalar; message prefix/format alignment.

## 4. Corrections to prior capture notes (probed evidence wins)

- The earlier claim that the Java parser does not parse fn calls in
  operand position is wrong: calls parse as FUNCTION_CALL and render
  literally in leaves; operations and guard compares fail with typed
  errors.
- The earlier claim that Java renders calc(...) literally is wrong: calc
  evaluates as a leaf (with embedded warning comment); only in
  operations does it fail.
- The earlier note that function calls evaluate in guards, mixin call
  arguments and definitions is wrong for main: guards, arguments and
  definitions hold the raw call; nothing evaluates.
- The future compat question is unaffected: TS's leaf evaluation can be
  re-enabled behind a gate; Java main's literal render remains the
  default.
