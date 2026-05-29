// JavaReferenceProbe - compiles every .less file in a dir with default
// options (Java main surface) and pins byte-exact outputs.
//
//   OK  -> <out>/<name>.css   (raw compile() bytes, no escaping)
//   ERR -> <out>/<name>.err   (verbatim LessException.getMessage(), no
//                              trailing newline)
//
// Warnings go to stderr; the probe does not mix them into pinned files.
//
// Usage: java -cp "<classpath>" JavaReferenceProbe <less-dir> <out-dir>
//
// Build/run (Java main classes + test classes + gradle jars):
//   CP="<java-dir>/build/classes/java/main:<java-dir>/build/classes/java/test:$(find ~/.gradle -name '*.jar' | tr '\n' ':')"
//   javac -proc:none -cp "$CP" -d /tmp JavaReferenceProbe.java
//   java -cp "/tmp:$CP" JavaReferenceProbe <less-dir> <out-dir>

import com.squarespace.less.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

public class JavaReferenceProbe {

  public static void main(String[] args) throws Exception {
    File srcDir = new File(args[0]);
    File outDir = new File(args[1]);
    Files.createDirectories(outDir.toPath());

    File[] files = srcDir.listFiles((d, n) -> n.endsWith(".less"));
    int ok = 0;
    int err = 0;
    for (File f : files) {
      String raw = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
      String label = f.getName().replace(".less", "");
      LessCompiler c = new LessCompiler();
      LessContext ctx = new LessContext(new LessOptions());
      try {
        String css = c.compile(raw, ctx);
        Files.write(outDir.toPath().resolve(label + ".css"),
            css.getBytes(StandardCharsets.UTF_8));
        System.out.println(label + "\tOK\t" + css.replace("\n", "\\n"));
        ok++;
      } catch (LessException ex) {
        String msg = ex.getMessage();
        Files.write(outDir.toPath().resolve(label + ".err"),
            msg.getBytes(StandardCharsets.UTF_8));
        System.out.println(label + "\tERR\t" + msg.replace("\n", "\\n"));
        err++;
      }
    }
    System.out.println("TOTAL OK=" + ok + " ERR=" + err);
  }
}
