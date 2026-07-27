import type { MetadataRoute } from "next";

/**
 * 홈 화면에 추가했을 때 사파리 껍데기가 아니라 독립 실행(standalone)으로 뜨게 한다.
 * 이게 있어야 화면이 상태바 밑까지 깔리고 env(safe-area-inset-top) 이 실제 값을 준다
 * (없으면 0 이라, 노치 영역 배경을 늘리는 CSS 가 아무 일도 하지 않는다).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "재수없수 | 우리 아이 재수 안심 케어",
    short_name: "재수없수",
    description: "성적 분석, 재수 비용 계산, 보험금 청구를 한곳에서 돕는 보호자용 안심 서비스입니다.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0cb474",
    theme_color: "#0cb474",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
