# Corpus v2 (alignment corpus)

Pinned byte-exact reference corpus (byte-parity with Java
`main` at default options). 78 fixtures, Java main: 56 OK / 22 ERR.

Layout:

    less/*.less       fixtures (numbered: 01x values, 02x defs, 03x mixin
                      args, 04x guards, 05x media, 21x colors, 22x
                      fn set, 23x color math, 31x-32x errors, 40x-43x
                      compat-level cells, 50x-54x compat-level cells)
    java-main/        PINNED reference (unwired 2-arg context): <name>.css
                      = raw compile() bytes, <name>.err = verbatim
                      LessException.getMessage()
    levels/java-ladder/<level>/   PINNED reference (wired context, function
                      table active) at compat levels 0, 1, 2; same css/err
                      naming
    levels/expected-diff.json     registered divergent cells (fixture,
                      level, reason); the harness asserts inequality on
                      them (flip detector) and equality everywhere else
    ts-current/       TS output for contrast (regenerable, never truth)
    BOUNDARY.md       pinned boundary table (the deliverable)
    tools/            JavaReferenceProbe.java, JavaLadderProbe.java,
                      ts-probe.js

Parity gate: `npm run parity` in packages/less-ts runs
`__tests__/corpus-parity.test.ts`, byte-comparing TS compile() output
against the pinned java-main/ files (css for OK fixtures, error text for
ERR fixtures); green when every bare-surface cell byte-matches or is
registered in expected-diff.json (level "bare", asserted as
inequality - the flip detector). `__tests__/corpus-parity-levels.test.ts`
does the same against the ladder pins at levels 0/1/2 (every pin on
disk is a cell).

## Regenerate the Java reference

Requires a Java `main` build (the only reference) and the gradle jars:

```sh
cd <java-dir> && git checkout main && ./gradlew classes testClasses
CP="<java-dir>/build/classes/java/main:<java-dir>/build/classes/java/test:$(find ~/.gradle -name '*.jar' | tr '\n' ':')"
javac -proc:none -cp "$CP" -d /tmp tools/JavaReferenceProbe.java \
    tools/JavaLadderProbe.java
java -cp "/tmp:$CP" JavaReferenceProbe less java-main
```

The ladder family (wired context, function table active) comes from
`JavaLadderProbe`, one run per level:

```sh
for level in 0 1 2; do
  java -cp "/tmp:$CP" JavaLadderProbe less levels/java-ladder/$level $level
done
```

Warning comments (INCOMPATIBLE_UNITS) land inside the compile() output;
the probe never mixes stderr into pinned files.

## Regenerate the TS contrast

```sh
cd packages/less-ts && npm run build
node __tests__/data/corpus/tools/ts-probe.js __tests__/data/corpus/less __tests__/data/corpus/ts-current
```
