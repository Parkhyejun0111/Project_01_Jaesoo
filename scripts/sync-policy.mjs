/**
 * 약관 HTML 을 web·app 의 public/policy 로 복사한다.
 *
 * 원본 1부(api/policy/)가 단일 진실이고 프론트는 사본을 서빙한다 — 사람이 손으로
 * 복제하면 세 곳이 어긋나므로 빌드 전에 이 스크립트를 돌린다.
 * (web/app package.json 의 prebuild 에 연결되어 있다)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "api", "policy");
const targets = [join(root, "web", "public", "policy"), join(root, "app", "public", "policy")];

if (!existsSync(source)) {
  console.error(`✗ 약관 원본 폴더가 없습니다: ${source}`);
  process.exit(1);
}

const files = readdirSync(source).filter((f) => f.endsWith(".html"));
if (files.length === 0) {
  console.error(`✗ ${source} 에 약관 HTML 이 없습니다`);
  process.exit(1);
}

for (const target of targets) {
  mkdirSync(target, { recursive: true });
  for (const file of files) {
    copyFileSync(join(source, file), join(target, file));
  }
  console.log(`✓ ${files.length}개 → ${target.replace(root + "/", "")}`);
}
