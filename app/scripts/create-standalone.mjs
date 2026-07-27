import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { Script } from "node:vm";

const projectRoot = resolve(import.meta.dirname, "..");
const isDesignSystem = process.argv[2] === "design-system";
const buildRoot = join(projectRoot, isDesignSystem ? "standalone-design-system-dist" : "standalone-dist");
const assetRoot = join(buildRoot, "assets");
const outputRoot = join(projectRoot, "exports");
const outputFile = join(outputRoot, isDesignSystem ? "jaesoo-design-system.html" : "jaesoo-app.html");

const assetFiles = await readdir(assetRoot);
const javascriptFile = assetFiles.find((file) => extname(file) === ".js");
const stylesheetFile = assetFiles.find((file) => extname(file) === ".css");

if (!javascriptFile || !stylesheetFile) {
  throw new Error("Standalone JavaScript or CSS bundle was not generated.");
}

let javascript = await readFile(join(assetRoot, javascriptFile), "utf8");
const stylesheet = await readFile(join(assetRoot, stylesheetFile), "utf8");

const embeddedImages = [
  ["jaesoo_character.png", "image/png"],
  ["logo-final-dark.png", "image/png"],
  ["logo-final-white.png", "image/png"],
  ["paw-loader.png", "image/png"],
  ["grade-analysis.png", "image/png"],
];

for (const [filename, mimeType] of embeddedImages) {
  const image = await readFile(join(projectRoot, "public", filename));
  const dataUri = `data:${mimeType};base64,${image.toString("base64")}`;
  javascript = javascript
    .replaceAll(`"/${filename}"`, JSON.stringify(dataUri))
    .replaceAll(`'/${filename}'`, JSON.stringify(dataUri))
    .replaceAll(`\`/${filename}\``, JSON.stringify(dataUri));
}

javascript = javascript.replaceAll("</script", "<\\/script");
new Script(javascript);

const output = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0CB474">
  <title>재수없수</title>
  <style>${stylesheet}</style>
</head>
<body>
  <div id="root"></div>
  <script>${javascript}</script>
</body>
</html>`;

const finalizedOutput = isDesignSystem
  ? output.replace(/<title>[\s\S]*?<\/title>/, "<title>Jaesoo Design System</title>")
  : output;

await mkdir(outputRoot, { recursive: true });
await writeFile(outputFile, finalizedOutput, "utf8");

const checks = {
  title: output.includes("<title>재수없수</title>"),
  root: output.includes('<div id="root"></div>'),
  classicScript: output.includes("<script>"),
  scriptParsed: true,
  style: output.includes("<style>"),
  imagesEmbedded: !embeddedImages.some(([filename]) => output.includes(`/${filename}`)),
  completeDocument: output.endsWith("</html>"),
};

if (Object.values(checks).some((passed) => !passed)) {
  throw new Error(`Standalone validation failed: ${JSON.stringify(checks)}`);
}

console.log(outputFile);
console.log(JSON.stringify(checks));
