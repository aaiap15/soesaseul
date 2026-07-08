// ===== 쇠친 설정 =====
// Supabase 값을 넣으면 → 여러 폰이 공유하는 실시간 공용 DB로 동작 (실제 수요 테스트용)
// 비워두면        → 이 기기 브라우저에만 저장 (혼자 로컬 확인용)
//
// 세팅 방법은 README.md 참고 (무료, 5분).
window.SOECHIN_CONFIG = {
  SUPABASE_URL: "",       // 예: "https://abcd1234.supabase.co"
  SUPABASE_ANON_KEY: "",  // 예: "eyJhbGciOiJIUzI1Ni...."  (anon public key — 공개돼도 안전)
  APP_NAME: "쇠친",
  SUBTITLE: "같이 운동할 사람, 여기서 찾자",
};
