// Copies the Nitro build output into dist/ for hosts (e.g. Spacefast) that expect dist/client.
import { cpSync, existsSync, rmSync } from "node:fs";

if (!existsSync(".output/public")) {
  process.stderr.write("postbuild: .output/public not found, skipping copy\n");
  process.exit(0);
}
rmSync("dist", { recursive: true, force: true });
cpSync(".output/public", "dist/client", { recursive: true });
if (existsSync(".output/server")) cpSync(".output/server", "dist/server", { recursive: true });
