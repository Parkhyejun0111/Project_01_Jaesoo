import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.resolve(
  "node_modules/vinext/dist/server/static-file-cache.js",
);
const before = 'relativePath: path.relative(base, batch[j]),';
const after =
  'relativePath: path.relative(base, batch[j]).split(path.sep).join("/"),';

try {
  const source = await readFile(target, "utf8");

  if (source.includes(after)) {
    console.log("vinext Windows static-path patch already applied.");
  } else if (source.includes(before)) {
    await writeFile(target, source.replace(before, after), "utf8");
    console.log("Applied vinext Windows static-path patch.");
  } else {
    console.warn("vinext static-path patch target was not found; skipped.");
  }
} catch (error) {
  if (error?.code === "ENOENT") {
    console.warn("vinext is not installed; static-path patch skipped.");
  } else {
    throw error;
  }
}
