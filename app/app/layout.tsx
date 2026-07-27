import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

/**
 * 입력칸을 누르면 iOS 사파리가 글자 크기 16px 미만인 필드에 자동으로 줌인한다.
 * 앱처럼 배율이 고정돼야 하므로 확대를 막고, 키보드가 올라올 때는 배율 대신
 * 레이아웃이 줄어들도록(resizes-content) 둔다.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0cb474",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "재수없수 | 우리 아이 재수 안심 케어",
    description:
      "성적 분석, 재수 비용 계산, 보험금 청구를 한곳에서 돕는 보호자용 안심 서비스입니다.",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: "/icon-192.png",
    },
    // 홈 화면에 추가했을 때 사파리 껍데기가 아니라 독립 실행으로 뜨게 하는 설정.
    // statusBarStyle 이 black-translucent 여야 화면이 상태바(노치·다이나믹 아일랜드)
    // 밑까지 깔리고 env(safe-area-inset-top) 이 실제 값을 준다. default 면 iOS 가
    // 상태바를 불투명하게 따로 잡아 0 이 되고, 노치 배경을 늘리는 CSS 가 무력해진다.
    // (iOS 16.4+ 는 manifest 의 display:standalone 도 함께 본다)
    appleWebApp: {
      capable: true,
      title: "재수없수",
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      title: "재수없수 | 우리 아이 재수 안심 케어",
      description: "AI 도우미 노재수와 함께 성적과 재수 비용을 든든하게 관리하세요.",
      type: "website",
      images: [{ url: imageUrl, width: 1680, height: 940, alt: "재수없수 안심 케어 서비스" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "재수없수 | 우리 아이 재수 안심 케어",
      description: "보험보다 보호자에 가까운 재수 안심 서비스",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-canvas="gray-white">
      <body>{children}</body>
    </html>
  );
}
