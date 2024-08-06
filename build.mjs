import * as esbuild from "esbuild";
import * as fs from "node:fs/promises";

async function main(watch) {
  const ctx = await esbuild.context({
    entryPoints: ["srcts/index.ts"],
    bundle: true,
    outfile: "dist/index.js",
  });
  try {
    if (!watch) {
      if (!(await build(ctx))) {
        process.exit(1);
      }
    } else {
      await build(ctx);
      const watcher = fs.watch("srcts", { recursive: true });
      for await (const { eventType, filename } of watcher) {
        console.error(`Rebuilding (${filename})`);
        await build(ctx);
      }
    }
  } finally {
    await ctx.dispose();
  }
}

async function build(ctx) {
  const start = Date.now();
  try {
    try {
      const result = await ctx.rebuild();
      if (result.errors.length > 0) {
        console.error(result.errors);
        return false;
      }
      // Succeeded with warnings
      if (result.warnings.length > 0) {
        console.error(result.warnings);
      }
    } catch (e) {
      console.error(e);
      return false;
    }
    // We don't expect this to fail. If it throws, let it crash the process.
    await postBuild();
    return true;
  } finally {
    console.error("Build took " + (Date.now() - start) + "ms");
  }
}

async function postBuild() {
  await fs.cp("dist", "python-package/shinymedia/dist", {
    recursive: true,
    errorOnExist: false,
    preserveTimestamps: true,
  });
  await fs.cp("dist", "r-package/inst/dist", {
    recursive: true,
    errorOnExist: false,
    preserveTimestamps: true,
  });
  await fs.cp("dist", "docs/lib/shinymedia/", {
    recursive: true,
    errorOnExist: false,
    preserveTimestamps: true,
  });
}

await main(process.argv.includes("--watch"));
