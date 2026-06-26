# less-ts

A TypeScript port of the Squarespace Java LESS compiler. At the default
compat level the output reproduces the Java compiler's released behavior.

The compiler is frontend-only. It compiles one fully assembled master
stylesheet and performs no import resolution. The server resolves every
`@import` before the compiler sees the sheet. The import-related compat
patches exist in the registry but are inert for the same reason.

## Usage

```ts
import { LessCompiler } from '@squarespace/less-ts';

const compiler = new LessCompiler({ indentSize: 2 });
const { css, errors } = compiler.compile('@base: 10px;\n.a { width: @base * 2; }\n');
if (errors.length > 0) {
  console.error(compiler.formatErrors(errors).join('\n'));
} else {
  console.log(css);
}
```

`new LessCompiler(options)` takes an `Options` object (below). Methods:

- `compile(raw)` - parse, evaluate, and render. Returns `{ css, errors }`.
- `parse(raw)` - parse only. Throws `LessParseError` on failure.
- `formatErrors(events)` - format error events as readable reports.

## Options

All options are optional.

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `compatLevel` | number | `0` | Position on the fix ladder. Level 0 keeps every legacy behavior active (the released surface). At level N, patches whose threshold is at most N are fixed. |
| `compatPatches` | `{ [id: string]: boolean }` | none | Per-site overrides that force a legacy behavior on regardless of level. Only `true` entries apply. |
| `safeMode` | boolean | `false` | `false`: strict; a hard error is reported as an error event and fails the compile. `true`: best-effort; warn and recover at well-defined boundaries. Independent of the compat level. |
| `maxWarnings` | number | `0` | Overall warning budget per compile. `0` (the default) disables the overall limit. |
| `maxWarningsPerType` | number | `25` | Warning budget per type. `0` disables the per-type limit. |
| `compress` | boolean | `false` | Emit CSS with whitespace compressed. |
| `indentSize` | number | `2` | Spaces per indent level. Ignored when `compress` is set. |
| `fastcolor` | boolean | `false` | Accepted for option-set compatibility with the 1.1.5 surface; color output no longer varies with it. |
| `nocache` | boolean | `false` | Disable the internal definition caches; lookups scan the enclosing blocks instead. |
| `mixinRecursionLimit` | number | `64` | Maximum mixin recursion depth. |

## Compat levels and modes

The compat surface has two axes. The level says which fixes apply; the
mode says how violations behave. `compatPatches` is a per-site escape
hatch on both: it forces legacy behaviors on regardless of level, so a
level change keeps them.

### Level: which fixes apply

Each behavior fix has a threshold level. A patch's legacy behavior is
active while the compile level is below its threshold. Level 0 is the
default and preserves the released surface. Level 2 (the highest
threshold) is the fully fixed compiler; higher levels behave the same.
Each line below states a patch and its legacy behavior: what holds
while the compile level is below the patch's threshold.

Level 1 - the former safe-mode tolerances:

- `BUG1` - an extraneous `+` at block scope is tolerated.
- `BUG2` - a block-less `@media` is dropped; the statements that follow
  attach to the enclosing block.
- `BUG3` - a variable followed by empty parens, e.g. `@dk-gray();`, is
  accepted.
- `BUG4` - an invalid addition like `random(90) + px` is tolerated;
  parse backtracking is skipped.

Level 2:

- `ATTR_SELECTOR_UNTERMINATED` - an unterminated attribute selector or
  parenthesized element is dropped instead of failing the compile.
- `SELECTOR_COMPLEXITY_OVERFLOW` - selector-complexity overflow in a
  nested rule is swallowed; the current selector is dropped instead of
  failing the compile.
- `NONFINITE_AS_ZERO` - NaN and Infinity render as `0` instead of
  visible text.
- `MOD_ZERO_STRICT` - `mod(x, 0)` returns NaN instead of obeying the
  division contract.
- `CONVERT_INCOMPATIBLE_UNITS` - `convert()` to an incompatible unit
  emits `0` instead of failing the compile.
- `REPLACE_REGEX_GROUPS` - `replace()` treats `$` and `\` in the
  replacement as regex group references instead of inserting them
  literally.
- `VARIADIC_NAMED_ARG` - a named argument that targets the variadic
  parameter is rejected instead of binding to it.
- `ARGUMENTS_ORDER` - `arguments` is emitted in binding insertion order
  instead of parameter declaration order.
- `GUARD_COMPARE_UNCOMPARABLE` - uncomparable guard operands keep acting
  like -1; `<=`, `>=`, and `!=` evaluate true instead of false.
- `COLOR_BLEND_ALPHA` - color-blend functions drop the alpha channel;
  the result is opaque instead of keeping the larger input alpha.
- `COLOR_CHANNEL_PRECISION` - color channel math truncates fractional
  intermediates to ints before the final rounding.
- `NUMBER_EXPO` - `1e3` tokenizes as the number 1 and the identifier
  `e3` instead of a single number. At the fixed level exponents are part
  of numbers; em/ex units are unaffected.
- `FUNCTION_CALL_IN_VALUE` - value-position function calls render
  literally instead of evaluating against the function table.
- `IMPORT_URL_INLINE`, `IMPORT_EXT_CASE`, `IMPORT_ONCE_SUPPRESS` - the
  import patches. Dormant: this compiler has no importer.

### Mode: how violations behave

- Strict (default): a violation is a hard error, reported as an error
  event. Safe: warn and recover at well-defined boundaries, dropping the
  broken member with a warning comment. A recovery that rescues nothing
  (the whole sheet was skipped) is still a hard error.

## Errors and warnings

`compile()` never throws for parse or evaluation failures; they come
back as events in `errors` alongside whatever rendered. A `LessErrorEvent`
has three fields: `errors` (the messages, each `{ type, message }` where
type is `'parse'` or `'runtime'`), `node` (where the error was raised),
and `stack` (the block context). `formatErrors(events)` turns them into
reports.

- Parse failure: `css` is empty and there is one parse event.
- Evaluation failure, strict: the failing member renders empty or not
  at all, the error is reported as a runtime event, and the rest of the
  sheet renders.
- One render-phase failure throws out of `compile()`: a selector
  combination that overflows the complexity limit, at the fixed levels
  (2 and above) in strict mode. Safe mode truncates the combination at
  the limit with a warning instead.

Warnings render as comments in the CSS, numbered per compile:

- Recovery drops, e.g. a member that fails to evaluate or a statement
  that cannot be parsed:

  `/* WARNING[1] raised during recovery: eval: dropped rule: ExecuteError VAR_UNDEFINED: ... */`

- Warnings that attach to the next member:

  `/* WARNING[1] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: ... */`

- The budget summary, when warnings were suppressed:

  `/* WARNING[2] suppressed: 1 warnings suppressed (1 eval-drop); limit 1 per type */`

Warning types bucket by phase: `eval-drop`, `render-skip`,
`parse-recovery`, or the error code for evaluation warnings (e.g.
`INCOMPATIBLE_UNITS`). `maxWarnings` caps the total per compile and
`maxWarningsPerType` caps each type; a cap of 0 disables it.

## Command-line interface

The `slessc` command ships in `@squarespace/less-ts-cli`:

```
slessc [options] <source>
```

Flags:

- `-p`, `--parse` - parse only. Stays strict; prints success or failure.
- `-i`, `--indent <n>` - indent size, default 2.
- `-r`, `--mixin-recursion-limit <n>` - mixin recursion limit, default 64.
- `-x`, `--compress` - minify the output.
- `-v`, `--version` - print `slessc:<version>` and exit 0.
- `-h`, `--help` - print usage and exit 0.
- `--` - ends flag scanning; only flags before it are handled.
- Unknown flags fail with usage text.

The compile path runs in safe (recovery) mode: a broken statement is
dropped with a warning comment instead of failing the run. The library
default stays strict. CSS goes to stdout; error reports go to stderr.
Exit code 0 on success, 1 on any hard error (including a recovery that
rescues nothing) or failure to read the source.

## Differences from the Java compiler

- Errors. Java throws on failure; this compiler reports parse and
  evaluation failures as structured events in `{ css, errors }`. The one
  thrown case is a render-phase selector-complexity overflow at the
  fixed levels in strict mode.
- Function table. The table ships built in and is always wired; there is
  no inert or unwired surface to configure. Value-position function
  calls evaluate against it at the fixed level and render literally
  below it, gated by the `FUNCTION_CALL_IN_VALUE` patch.
- `fastcolor`. A TS-only option with no Java counterpart. It is accepted
  for option-set compatibility, but color output no longer varies with
  it.
