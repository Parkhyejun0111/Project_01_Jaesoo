import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// 모노레포 루트를 명시한다 — 지정하지 않으면 Next 가 lockfile 위치를 추론하며 경고한다.
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  // 백엔드 주소는 @jaesoo/api-client 가 NEXT_PUBLIC_API_URL 로 읽는다.
  // Vercel 배포 시 프로젝트 환경변수에 설정할 것.
};

export default nextConfig;
