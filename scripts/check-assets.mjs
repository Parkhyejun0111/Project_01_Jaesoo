/**
 * 빌드 전 자산 점검 — iCloud Drive 에 아직 내려받지 않은 파일을 찾아낸다.
 *
 * 왜 필요한가: 이 저장소는 iCloud 로 동기화되는 폴더 안에 있고, 큰 이미지·폰트가
 * "플레이스홀더"(논리 크기만 있고 실제 블록은 0)로 남아 있을 수 있다. Vite 는
 * 빌드 때 public/ 을 통째로 복사하는데, 이런 파일을 읽으면 iCloud 온디맨드
 * 다운로드를 기다리며 **CPU 0% 로 무한정 멈춘다.** 게다가 일부는 0바이트로
 * 복사돼 산출물이 조용히 깨진다.
 *
 * 그래서 빌드를 시작하기 전에 먼저 확인하고, 문제가 있으면 즉시 실패시킨다.
 * (멈춘 빌드를 10분 기다리다 원인을 추측하는 것보다 낫다)
 */
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(process.argv[2] ?? join(root, "web", "public"));

/** 논리 크기는 있는데 실제 할당 블록이 0이면 아직 내려받지 않은 파일이다. */
function isDataless(path) {
  const st = statSync(path);
  return st.isFile() && st.size > 4096 && st.blocks === 0;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (isDataless(path)) out.push(path);
  }
  return out;
}

let missing = [];
try {
  missing = walk(target);
} catch (error) {
  console.warn(`⚠ 자산 점검을 건너뜁니다 (${target}): ${error.message}`);
  process.exit(0);
}

if (missing.length === 0) {
  process.exit(0);
}

console.error(
  `\n✗ iCloud 에서 아직 내려받지 않은 파일이 ${missing.length}개 있습니다.\n` +
    `  이 상태로 빌드하면 파일을 읽다가 무한정 멈추거나 0바이트로 복사됩니다.\n`,
);
for (const path of missing) {
  console.error(`    · ${relative(root, path)}`);
}
console.error(
  `\n  해결 방법 (하나만 하면 됩니다)\n` +
    `    1) Finder 에서 해당 폴더를 열고 파일을 선택 → 우클릭 → "지금 다운로드"\n` +
    `    2) 터미널:  brctl download "${relative(process.cwd(), target)}"\n` +
    `    3) 시스템 설정 → Apple 계정 → iCloud → "데스크탑 및 문서 폴더" 끄기\n` +
    `       (또는 저장소 최적화 해제)\n` +
    `    4) 자산 없이 우선 빌드하려면:  SKIP_ASSET_CHECK=1 npm run build\n`,
);

if (process.env.SKIP_ASSET_CHECK === "1") {
  console.error("  SKIP_ASSET_CHECK=1 이라 경고만 하고 계속합니다.\n");
  process.exit(0);
}
process.exit(1);
