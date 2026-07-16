# 폼클럽 — 크루로 운동 지속 (수요 검증 MVP)

"같이 운동하자"는 약속이 흐지부지되지 않게, **크루의 공동 스트릭(폼클럽)**으로 서로 끌고 가는 앱.
인증 1번 = 고리 +1. **한 명이라도 주간 목표를 못 채우면 사슬이 끊기고 🍗치킨이 적립**된다.

> 이전 컨셉(쇠친 = 모르는 사람 운동메이트 매칭)에서 피벗. 매칭이 아니라 **이미 아는 친구들끼리 약속 유지**가 핵심.
> 검증 가설: "크루가 서로의 연대책임으로 운동을 실제로 지속시키는가?"

## 구성

| 역할 | 파일 | 설명 |
|---|---|---|
| 📱 크루 앱 | [`index.html`](index.html) | 크루 생성·코드 참여·10초 인증·폼클럽·보드·치킨판·원격 타이머·가디언 |
| 🛠️ 운영자 화면 | [`admin.html`](admin.html) | 4주 생존율 · 2차 크루 생성률 · 크루별 고리/치킨 |
| 🗄️ 백엔드/DB | [`schema_crew.sql`](schema_crew.sql) | crews·members·checkins 테이블 (SQL 1회 실행) |
| ⚙️ 설정 | [`config.js`](config.js) | Supabase 키 (비우면 로컬 모드) |
| 🔌 데이터·로직 | [`db.js`](db.js) | Supabase↔localStorage 자동 전환 + `computeChain` 폼클럽 계산(공용) |

## 핵심 장치 (사업계획 §4)
- **폼클럽(공동 스트릭)** — 인증마다 고리 +1, 주간 미달 시 절단, 최고 기록 보존
- **치킨 판** — 미달 1명당 🍗 적립 → 시즌말 회수 (판돈 0, 무자본)
- **크루 보드** — 멤버 최신 인증이 피드로 (스와이프보드 문법)
- **원격 합방 타이머** — "운동 시작" → 크루에 `○○ 운동 중 N분` 라이브
- **가디언** — 운동 안 하는 지인도 응원으로 참여 (비대칭 참여)

## 바로 보기 (설정 0, 로컬)
```bash
cd 쇠친
python3 -m http.server 8080
# 크루 앱:  http://localhost:8080/index.html
# 운영자:   http://localhost:8080/admin.html   ← [🧪 샘플 데이터]로 전체 흐름 확인
```
키를 안 넣으면 이 브라우저에만 저장돼요(혼자 확인용).

## 실제 배포 (여러 폰 공용)
1. **Supabase → SQL Editor** 에 [`schema_crew.sql`](schema_crew.sql) 붙여넣고 Run
2. `Settings→API`의 URL·anon key를 [`config.js`](config.js)에 입력 → `git push`
3. GitHub Pages(Settings→Pages→branch: main)로 자동 배포 → 그 주소로 QR/링크 공유
4. 초대는 **코드** 또는 `…/index.html?code=ABCD` 링크 (열면 참여창 자동)

## 수요 검증 지표 (admin.html)
| 신호 | 의미 | 기준 |
|---|---|---|
| **크루 4주 생존율** | 약속이 실제로 지켜지나 | 4주+ 크루의 50%+ 생존 |
| **2차 크루 생성** | 만족한 사람이 새 크루를 또 만드나(바이럴) | 15%+ 면 강한 go |
| 이번주 활성 크루 / 고리 / 치킨 | 보조 지표 | — |

## Kill Criteria (시즌1)
20크루 중 4주 생존 10크루 미만 **그리고** 2차 크루 생성 3건 미만 → 구조 재설계.

## 데이터 모델
- `crews` (name, code, goal), `members` (crew_id, name, role=member|guardian), `checkins` (crew_id, member_id, type=workout|start|cheer, part, note)
- 익명 사용자는 읽기+등록만 (RLS). 폼클럽 계산은 인증 이력에서 `computeChain`이 파생.

> v1 범위. 동물 뱃지·명예의 전당·생존 증서 카드·네이티브 위젯은 v1.1로 보류.
