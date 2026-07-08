# 🏋️ 쇠친 — 대학생 운동메이트 매칭 (수요 검증 MVP)

QR 찍고 들어와서 **이름·나이·성별·운동부위**만 올리면, 같이 운동할 사람이 **신청**하는 모바일 웹앱.
운영자(영원)는 **운영자 화면**에서 신청자를 보고 수동으로 조를 짭니다. — 앱 설치 0, 서버코드 0.

> 목적: "대학생들이 운동메이트를 실제로 구하고 신청하는가?" 이 한 가설만 최소 비용으로 검증.

## 구성

| 역할 | 파일 | 설명 |
|---|---|---|
| 📱 프론트(사용자) | [`index.html`](index.html) | 모집글 보기 · 글 올리기 · 신청하기 |
| 🛠️ 운영자 화면 | [`admin.html`](admin.html) | 신청자 조회 · 수동 조 편성 · CSV 내보내기 |
| 🗄️ 백엔드/DB | [`schema.sql`](schema.sql) | Supabase 테이블 정의 (SQL 1회 실행) |
| ⚙️ 설정 | [`config.js`](config.js) | Supabase 키 입력 (비우면 로컬 모드) |
| 🔌 데이터 계층 | [`db.js`](db.js) | Supabase ↔ localStorage 자동 전환 |

---

## 지금 바로 보기 (설정 0, 로컬)

```bash
cd 쇠친
python3 -m http.server 8080
# 사용자:  http://localhost:8080/index.html
# 운영자:  http://localhost:8080/admin.html
```

키를 안 넣으면 데이터가 **이 브라우저에만** 저장돼요(혼자 확인용). `admin.html`의 **[🧪 샘플 데이터]** 로 전체 흐름을 바로 볼 수 있습니다.

---

## 실제 배포 (여러 폰이 공유하는 진짜 테스트) — 3단계, 무료 ~10분

### 1. Supabase 백엔드 만들기 (2분)
1. [supabase.com](https://supabase.com) 가입 → **New project** 생성
2. 좌측 **SQL Editor** → [`schema.sql`](schema.sql) 내용 붙여넣기 → **Run**
3. **Project Settings → API** 에서 두 값 복사:
   - `Project URL`
   - `anon public` 키 (공개돼도 안전한 키)

### 2. 키 입력
[`config.js`](config.js) 를 열어 붙여넣기:
```js
window.SOECHIN_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi....",
  ...
};
```
> 사용자 화면 우측 상단이 **● 실시간** 으로 바뀌면 공용 DB 연결 성공.

### 3. GitHub Pages 배포
- GitHub 레포 → **Settings → Pages → Source: Deploy from a branch** → Branch: `main` / `/ (root)` → **Save**
- 1~2분 뒤 `https://<유저>.github.io/soechin/` 로 접속 (정적 파일이라 빌드 불필요)
- 키(`config.js`)를 바꾼 뒤 `git push` 하면 자동 반영

### 4. QR 만들기
배포된 주소로 QR 생성 (qr-code-generator.com 등 무료 툴).
헬스장/기숙사/학교 게시판에 붙이면 → 찍고 바로 글 등록.

---

## 운영 플로우

```
게시판/기숙사에 QR 부착
   → 학생이 QR 찍고 글 등록 (이름·나이·성별·부위)
   → 다른 학생이 "같이 운동 신청"
   → 영원이 admin.html 에서 신청자 확인
   → 조번호 부여 → [카톡 초대문구 복사] → 조방 개설
```

## 수요 검증 지표 (admin.html 상단)
- **모집글 수** — 얼마나 올리는가
- **신청 수 / 글당 평균 신청** — 올린 글에 반응이 오는가 (핵심)
- **편성된 조** — 실제 매칭까지 이어지는가
- CSV로 내보내 정리 가능

---

## 데이터 모델
- `posts` : 모집글 (name, age, gender, part, contact, note)
- `applications` : 신청 (post_id, name, contact)

익명(anon) 사용자는 **읽기 + 등록만** 가능. 수정/삭제는 막혀 있어(RLS) 스팸은 Supabase 대시보드에서 운영자가 직접 삭제합니다.

> 이건 v1(검증용)입니다. 로그인·프로필·채팅·알림은 수요 확인 후 v2로.
