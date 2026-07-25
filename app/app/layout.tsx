import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

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
