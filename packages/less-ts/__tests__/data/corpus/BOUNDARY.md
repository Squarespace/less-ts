# Corpus v2 - Java main behavior boundary map (PINNED)

Pinned 2026-09-04 against Java `less-compiler` main @ 18f8f84, default
`LessOptions()`. Regenerate with `tools/JavaReferenceProbe.java` (see
README.md); the wired level pins under `levels/java-ladder/` come from
`tools/JavaLadderProbe.java`.

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

## 2. Fixture matrix (56 fixtures, 35 OK / 21 ERR)

Note: the TS-today column records the TS surface at pinning time
(pre-alignment). The Java column is the pinned truth; the default
surface now byte-matches it.

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

### 210-215: colors

| Fixture | Java main | TS today |
|---|---|---|
| 210 keywords red/blue/rebeccapurple | passthrough | hex except rebeccapurple |
| 211 `#aabbcc` `#abc` `#11223344` | `#abc` `#abc` `#123 44` | `#aabbcc` `#aabbcc` `#112233 44` |
| 212 `@c: red`; use | `red` passthrough | `#ff0000` |
| 213 `rgba(255,0,0,0.5)` `hsla(0,100%,50%,0.25)` | `rgba(255, 0, 0, .5)` `hsla(0, 100%, 50%, .25)` | same rgba; hsla -> rgba |
| 214 named hex | keyword for a few names (`red` `beige` `grey` `cyan` `dimgrey`), compressed hex for the rest (`#f0f` `#789` `#123`), `RED` case kept, `magenta` -> `#f0f` | hex for every name (`RED` kept), 6 digits |
| 215 alpha format | 8-digit alpha round: `.333333333333` -> `.33333333`; `.000000001` and `.999999999` -> empty alpha field `rgba(0, 0, 0, )` | no round; `e-9` / `e-8` exponents |

### 220: full fn set in values (all literal on Java)

`lighten darken mod round unit convert sqrt length extract fade mix
saturate` - all literal; TS evaluates all to computed values.

### 230-237: color math

| Fixture | Java main | TS today |
|---|---|---|
| 230 `#808080 / 3` | `#2a2a2a` (truncate) | `#2b2b2b` (round) |
| 231 `#fff * 0.5` | `#000` (frac scalar -> 0) | `#ffffff` (neither side!) |
| 232 `#808080 * 2`, `+`, `#010203 * 3` | `#fff`, `#fff`, `#030609` (clamp 255, int math) | same |
| 233 `rgba(0,0,0,0.5) * 2` | ERR INVALID_OPERATION2 (ctor = FUNCTION_CALL in op) | eval `#000000` |
| 234 `rgba + rgba` | ERR INVALID_OPERATION2 | eval |
| 235 math digest | `/0` -> `grey` (no error); `*1.5`, `+0.5`, `-0.5` truncate to `grey`; `#010203 / 2` -> `#000101` | `/0` -> `#ffffff`; rounds (`#010102` `#818181` `#7f7f7f`) |
| 236 `3 - #fff` | ERR BAD_COLOR_MATH (`A color cannot be subtracted from 3`) | OK `x: 3` (silent) |
| 237 `#fff + 1px` | ERR INCOMPATIBLE_UNITS (`... from PX (pixels) to COLOR`) | warns `... from px to color, stripping unit`, renders |

### 310-321: errors (messages verbatim in `.err` files)

| Fixture | Java main message (verbatim) | TS today |
|---|---|---|
| 310 `(1 / 0)` | `ExecuteError DIVIDE_BY_ZERO: Attempt to divide DIMENSION 1.0 by zero.` | `Error: Attempt to divide 1 by zero:` + context |
| 311 `.nope()` | `ExecuteError MIXIN_UNDEFINED: Failed to locate a mixin using selector .nope` | same text, `Error:` prefix + context |
| 312 `x: @nope` | `ExecuteError VAR_UNDEFINED: Failed to locate a definition for the variable @nope in current scope` | same text + prefix/context |
| 313 `@nope + 1px` | same as 312 | same as 312 |
| 315 `.m(1px, 2px)` vs 1-arg def | `ExecuteError MIXIN_UNDEFINED: Failed to locate a mixin using selector .m` | same text + prefix/context |
| 316 `alpha(opacity=10%)` | `SyntaxError ALPHA_UNITS_INVALID Numeric values for alpha cannot have units. Found DIMENSION 10.0 % (percentage)` | `Numeric values for alpha cannot have units.` (no type, no found value) |
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

## 5. Gate cells (40x-43x, 50x-54x) - pinned at the same tip

These fixtures exercise the compat-level gates not yet implemented on
the TS side. Pin families as in section 1: `java-main/` (bare) and
`levels/java-ladder/{0,1,2}/` (wired). The levels harness
(`corpus-parity-levels.test.ts`) byte-compares TS at each level against
every ladder pin; `corpus-parity.test.ts` covers the bare surface.
`levels/expected-diff.json` registers the cells that diverge today for
a documented reason; registered cells assert inequality (flip
detector: when the behavior lands the test goes red and the entry is
removed), all others assert strict equality.

### 40x number exponent (400, 401)

Legacy (bare/L0/L1): no exponent grammar - `9.999999999999999e+31`
renders `10 e 31`, `7E705E` renders `7 E705E`, `1e3` renders `1 e3`,
`1.5e-3` renders `1.5 e-3`, `2E2` renders `2 E2`; `em`/`ex` unaffected.
Fixed (L2): single numbers - `99999999999999990000000000000000`,
`Infinity E` (the overflow renders visibly because the non-finite
legacy is lifted at L2), `1000`, `.0015`, `200`. TS today: legacy
tokenization at every level. Green bare/L0/L1; L2 registered.

### 41x unterminated selector (410 attr, 411 paren element)

Legacy: silently dropped, the bare element is styled (`a { color: red;
}`). Fixed (L2): `SyntaxError INCOMPLETE_PARSE Unable to complete
parse.` (the pin type flips css-to-err at L2). TS matches the legacy
side at every level today; L2 registered.

### 42x uncomparable guard truth table (420-426)

Shape `.m(@a) when (@a <OP> 10px) { p: 1; }` + `.x { .m(red); }` (color
vs dimension - uncomparable). Java legacy = uncomparable compares as
-1: `<` T, `<=` T, `=` F, `!=` T, `>` F, `>=` F. Java fixed (L2) =
only `<` T. TS today matches the legacy table at every level. Green
except 421 (`<=`) and 423 (`!=`) at L2 (registered). 426 is the
comparable control (green at every level).

### 43x selector complexity overflow (430)

Shape: 65 comma siblings wrapping 63 nested single-selector levels.
Java legacy: the overflow is swallowed at the last nested level, the
rendered selectors end at `.b61` (19897 bytes). Java L2: `ExecuteError
SELECTOR_TOO_COMPLEX: Selector exceeds the complexity threshold`. TS
today: no threshold; renders the full combination (20222 bytes) at
every level. Diverges on all four surfaces (registered bare/0/1/2);
the level-0 divergence is tracked as a follow-up.

### 50x color blend alpha (500 multiply, 501 screen)

`multiply(rgba(255, 0, 0, 0.5), rgba(0, 0, 255, 0.25))`. Bare: literal
call. Wired L0/L1: opaque result (`#000` / `#f0f`). Wired L2: keeps
the larger input alpha (`rgba(0, 0, 0, .5)` / `rgba(255, 0, 255, .5)`).
TS today renders the call literally at every level (the
function-table family); the wired cells are registered.

### 51x replace regex groups (510 group refs, 511 backslash)

`replace` is ext-only on Java and the ladder reference wires the
default function table, so every pinned surface renders the call
literally and TS matches byte-for-byte (green at every level). The
legacy/fixed replacement contract (group refs vs literal insert) is
exercised by the gate work's unit tests, not by these pins.

### 52x mod zero (520) + control (521)

`mod(10, 0)`: bare literal; wired L0/L1 `0` (silent NaN renders 0);
wired L2 `ExecuteError DIVIDE_BY_ZERO: Attempt to divide DIMENSION 10.0
by zero.` `mod(11, 3)` control: `2` on every wired surface. TS today:
literal at every level; the wired cells are registered.

### 53x convert incompatible units (530) + control (531)

`convert(16px, em)`: bare literal; wired L0/L1 `0em`; wired L2
`ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from PX
(pixels) to EM (element font size)`. `convert(1in, px)` control: `96px`
on every wired surface. TS today: literal at every level; the wired
cells are registered.

### 54x mixin arguments (540) + variadic named arg (541)

Mixin mechanics: bare byte-equals wired L0/L1. 540 (`.m(@a, @b) { p:
@arguments; }` / `.x { .m(@b: 2, @a: 1); }`): legacy `p: 2 1` (binding
insertion order), fixed `p: 1 2` (declaration order); TS matches the
legacy side today, L2 registered. 541 (`.m(@b...) { p: @b; }` / `.x {
.m(@b: 1); }`): legacy `ExecuteError ARG_NAMED_NOTFOUND: Named arg @b
not found` on every legacy surface, fixed `p: 1`; TS matches the
legacy side, L2 registered.

### Base 56 at the wired levels

32 fixtures diverge identically at L0/L1/L2 (the function-table
family: TS renders calls literally, the wired reference evaluates -
the pins are the future reference); 24 are green at every wired level
(the calc, color-output, channel-math, and error cells). Notable
type-flip cells among the 32: 016/018/024/034/040-043/045/233/234
(java evaluated vs TS operation error), 017 (java INVALID_ARG_EXT vs
TS literal), 044 (different error message on both sides). Per-cell
registration is the expected-diff.json registry.
