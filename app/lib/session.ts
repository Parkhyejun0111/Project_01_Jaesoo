"use client";

/**
 * 세션 — 어느 학생의 계약을 보고 있는가.
 *
 * 웹(가입 완료 화면)이 `?student_id=stu_xxx` 로 앱을 열어 주므로, 최초 진입 시
 * 쿼리에서 집어 로컬에 저장한다. 이후에는 저장된 값을 쓰고, 없으면 로그인
 * 화면에서 데모 학생을 고른다(프로토타입 범위 — 실인증은 도입하지 않는다).
 */

const STORAGE_KEY = "jaesoo.student_id";

export function readHandoffId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("student_id");
    if (fromQuery) {
      window.localStorage.setItem(STORAGE_KEY, fromQuery);
      // 주소창에서 식별자를 지운다 — 공유·북마크로 새어 나가지 않도록
      const url = new URL(window.location.href);
      url.searchParams.delete("student_id");
      window.history.replaceState({}, "", url.toString());
      return fromQuery;
    }
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveStudentId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 사파리 프라이빗 모드 등 — 세션은 메모리로만 유지된다 */
  }
}
