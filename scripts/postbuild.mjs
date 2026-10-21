// Ensures static hosts that expect dist/client get a complete site.
// Some build setups (e.g. Lovable) already write straight to dist/; others (Nitro) write to .output/.
import { cpSync, existsSync, rmSync } from "node:fs";

const required = ["index.html", "auth/index.html"];

if (existsSync(".output/public")) {
  for (const f of required) {
    if (!existsSync(`.output/public/${f}`)) {
      throw new Error(`postbuild: .output/public/${f} was not created; refusing to publish an incomplete static site`);
    }
  }
  rmSync("dist", { recursive: true, force: true });
  cpSync(".output/public", "dist/client", { recursive: true });
  if (existsSync(".output/server")) cpSync(".output/server", "dist/server", { recursive: true });
} else if (!existsSync("dist/client")) {
  throw new Error("postbuild: no build output found in .output/public or dist/client");
}
