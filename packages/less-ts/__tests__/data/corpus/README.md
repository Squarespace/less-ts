# Corpus v2 (alignment corpus)

Pinned byte-exact reference corpus (byte-parity with Java
`main` at default options). 56 fixtures, Java main: 35 OK / 21 ERR.

Layout:

    less/*.less       fixtures (numbered: 01x values, 02x defs, 03x mixin
                      args, 04x guards, 05x media, 21x colors, 22x
                      fn set, 23x color math, 31x-32x errors)
    java-main/        PINNED reference: <name>.css = raw compile() bytes,
                      <name>.err = verbatim LessException.getMessage()
    ts-current/       TS output for contrast (regenerable, never truth)
    BOUNDARY.md       pinned boundary table (the deliverable)
    tools/            JavaReferenceProbe.java, ts-probe.js

Parity gate: `npm run parity` in packages/less-ts runs
`__tests__/corpus-parity.test.ts`, byte-comparing TS compile() output
against the pinned java-main/ files (css for OK fixtures, error text for
ERR fixtures). RED until the alignment work lands; the gate is
green when all 56 fixtures byte-match.

## Regenerate the Java reference

Requires a Java `main` build (the only reference) and the gradle jars:

```sh
cd <java-dir> && git checkout main && ./gradlew classes testClasses
CP="<java-dir>/build/classes/java/main:<java-dir>/build/classes/java/test:$(find ~/.gradle -name '*.jar' | tr '\n' ':')"
javac -proc:none -cp "$CP" -d /tmp tools/JavaReferenceProbe.java
java -cp "/tmp:$CP" JavaReferenceProbe less java-main
```

Warning comments (INCOMPATIBLE_UNITS) land inside the compile() output;
the probe never mixes stderr into pinned files.

## Regenerate the TS contrast

```sh
cd packages/less-ts && npm run build
node __tests__/data/corpus/tools/ts-probe.js __tests__/data/corpus/less __tests__/data/corpus/ts-current
```
