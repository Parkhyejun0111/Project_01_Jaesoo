import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");

/**
 * 화면 코드는 web 에 한 벌만 둔다 — 여기서는 그 App.jsx 를 appMode 로 켜서 쓴다.
 * 정적 자산(강사 사진·폰트·약관)도 web/public 을 그대로 가리켜 사본을 만들지 않는다.
 */

/** 홈 화면에 추가했을 때 앱처럼 뜨도록 PWA 매니페스트를 빌드 산출물에 넣는다. */
function webappManifest() {
  const manifest = {
    name: "메가에듀패스 — 재수없수 보험",
    short_name: "메가에듀패스",
    description: "인강 수강 중 가입하는 재수비용 보장보험. 웹과 같은 내용을 앱 화면에 맞춰 보여줍니다.",
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2B4FE8",
    lang: "ko",
    icons: [
      { src: "./icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "./icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "./icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return {
    name: "webapp-manifest",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: JSON.stringify(manifest, null, 2),
      });
      // 아이콘은 web/public(공용 자산)이 아니라 이 패키지가 들고 있으므로 직접 넣는다
      for (const name of ["icon-192.png", "icon-512.png"]) {
        this.emitFile({
          type: "asset",
          fileName: name,
          source: readFileSync(resolve(here, "icons", name)),
        });
      }
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: resolve(repo, "web", "public"),
  plugins: [react(), webappManifest()],
  server: {
    port: 5174,
    // web/src 를 상위 경로에서 import 하므로 dev 서버에 그 범위를 열어준다
    fs: { allow: [repo] },
  },
});
