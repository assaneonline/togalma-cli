import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = new URL(".", import.meta.url);
const pkgPath = fileURLToPath(new URL("../package.json", here));
const genPath = fileURLToPath(new URL("../src/version.generated.ts", here));
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const version = String(pkg.version || "0.0.0");
writeFileSync(
  genPath,
  `export const CLI_VERSION: string = ${JSON.stringify(version)};\n`,
  "utf8"
);

const result = spawnSync(
  "tsup",
  [
    "src/cli.ts",
    "--format",
    "esm",
    "--platform",
    "node",
    "--target",
    "node18",
    "--sourcemap",
    "--clean",
  ],
  { stdio: "inherit", env: process.env }
);

process.exit(result.status ?? 1);

