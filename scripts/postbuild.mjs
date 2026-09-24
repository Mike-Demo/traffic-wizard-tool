// Copies the Nitro build output into dist/ for hosts that expect dist/client.
import { cpSync, existsSync, rmSync } from "node:fs";

if (!existsSync(".output/public")) {
  throw new Error("postbuild: .output/public was not created");
}
if (!existsSync(".output/public/index.html")) {
  throw new Error(
    "postbuild: .output/public/index.html was not created; refusing to publish an incomplete static site",
  );
}
if (!existsSync(".output/public/auth/index.html")) {
  throw new Error(
    "postbuild: .output/public/auth/index.html was not created; refusing to publish an incomplete static site",
  );
}
rmSync("dist", { recursive: true, force: true });
cpSync(".output/public", "dist/client", { recursive: true });
if (existsSync(".output/server")) cpSync(".output/server", "dist/server", { recursive: true });
