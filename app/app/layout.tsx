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
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
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
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
