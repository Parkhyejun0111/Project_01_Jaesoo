import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 개발 서버에서 /api 요청을 로컬 FastAPI(main.py)로 넘긴다.
  // 덕분에 개발 중에는 VITE_API_BASE 를 설정하지 않아도 버튼이 동작한다.
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
