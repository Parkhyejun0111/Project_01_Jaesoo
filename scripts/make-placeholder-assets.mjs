/**
 * 임시 자산 생성기 — 원본 이미지를 아직 확보하지 못한 자리를 메운다.
 *
 * 왜 필요한가: 원본 저장소가 iCloud Drive 안에 있어 큰 이미지·폰트가 아직
 * 내려받아지지 않았고(SF_DATALESS), 그 파일을 읽으면 빌드가 멈춘다. 원본을
 * 확보할 때까지 개발·빌드를 계속할 수 있도록 같은 크기·같은 경로의 자리표시
 * 이미지를 만든다.
 *
 * 원본이 생기면 이 스크립트를 다시 돌릴 필요 없이 파일만 덮어쓰면 된다.
 * 어떤 파일이 임시인지는 ASSETS-TODO.md 와 각 파일 옆의 .placeholder 표식으로 안다.
 *
 * 실행:  node scripts/make-placeholder-assets.mjs
 *
 * 의존성 없이 zlib 만으로 유효한 PNG 를 직접 인코딩한다.
 */
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 자리표시 이미지 정의: [경로, 너비, 높이, 배경, 라벨] */
const PLACEHOLDERS = [
  // 웹 — 랜딩 강사 카드 (세로형 프로필)
  ["web/public/instructors/cha-mirae-angled-clean.png", 420, 620, [91, 124, 250], "차미래 · 국어"],
  ["web/public/instructors/yunseo-math-card-polished.png", 420, 620, [11, 143, 88], "이윤서 · 수학"],
  ["web/public/instructors/choi-jihyun-fixed.png", 420, 620, [176, 58, 91], "최지현 · 사회문화"],
  ["web/public/instructors/han-heeji-history-card.png", 420, 620, [183, 121, 31], "한희지 · 한국사"],
  // 웹·앱 공용 마스코트
  ["web/public/jaesoo_character.png", 240, 240, [11, 143, 88], "노재수"],
  ["app/public/jaesoo_character.png", 240, 240, [11, 143, 88], "노재수"],
  // 앱 — 로고·일러스트
  ["app/public/jaesoo_logo.png", 600, 200, [0, 70, 42], "재수없수"],
  ["app/public/logo-final-dark.png", 600, 200, [0, 70, 42], "재수없수"],
  ["app/public/logo-final-white.png", 600, 200, [255, 255, 255], "재수없수"],
  ["app/public/logo_final_white.png", 600, 200, [255, 255, 255], "재수없수"],
  ["app/public/donworry_icon4.png", 320, 320, [19, 188, 173], "돈워리"],
  ["app/public/grade-analysis.png", 640, 400, [59, 89, 152], "성적분석"],
  ["app/public/paw-loader.png", 120, 120, [11, 143, 88], ""],
  ["app/public/paw-loader-source.png", 240, 240, [11, 143, 88], ""],
  ["app/public/paw-steps.png", 480, 160, [11, 143, 88], ""],
];

// ── 최소 PNG 인코더 ────────────────────────────────────────────────────────
function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 대각선 줄무늬를 넣어 '진짜 이미지가 아님'이 눈에 바로 보이게 한다 */
function png(width, height, [r, g, b]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    raw[p] = 0; // filter: none
    p += 1;
    for (let x = 0; x < width; x += 1) {
      const stripe = (x + y) % 48 < 24 ? 1 : 0.82;
      raw[p] = Math.round(r * stripe);
      raw[p + 1] = Math.round(g * stripe);
      raw[p + 2] = Math.round(b * stripe);
      p += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    // 어떤 파일이 임시인지 이미지 자체에도 남긴다
    chunk("tEXt", Buffer.from("Comment\0PLACEHOLDER - replace with the real asset", "latin1")),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const created = [];
for (const [relPath, w, h, color, label] of PLACEHOLDERS) {
  const target = join(root, relPath);
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target) && !existsSync(`${target}.placeholder`)) {
    continue; // 진짜 자산이 이미 있으면 건드리지 않는다
  }
  writeFileSync(target, png(w, h, color));
  writeFileSync(
    `${target}.placeholder`,
    `임시 자산입니다. 원본을 확보하면 이 파일과 함께 지우고 진짜 이미지로 교체하세요.\n` +
      `설명: ${label || "(장식용)"}\n`,
  );
  created.push(relPath);
}

console.log(`✓ 임시 이미지 ${created.length}개 생성`);
for (const path of created) console.log(`    · ${path}`);
