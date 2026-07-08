-- ===== 쇠친 백엔드 스키마 (Supabase) =====
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 [Run] 한 번이면 백엔드 완성.

-- 1) 모집글: 이름/나이/성별/운동부위
create table if not exists posts (
  id          bigint generated always as identity primary key,
  name        text not null,
  age         int,
  gender      text,
  part        text,               -- 콤마로 여러 부위: "가슴,팔"
  contact     text,               -- 작성자 연락처(선택)
  note        text,
  created_at  timestamptz default now()
);

-- 2) 신청: 어떤 모집글에 누가 신청했는지
create table if not exists applications (
  id          bigint generated always as identity primary key,
  post_id     bigint references posts(id) on delete cascade,
  name        text not null,
  contact     text,
  created_at  timestamptz default now()
);

-- 3) RLS (익명 사용자가 QR로 들어와 읽기/쓰기 가능하게)
alter table posts        enable row level security;
alter table applications enable row level security;

-- 누구나 읽기 (drop-if-exists → 여러 번 실행해도 에러 없이 안전)
drop policy if exists "public read posts" on posts;
drop policy if exists "public read apps"  on applications;
create policy "public read posts" on posts        for select using (true);
create policy "public read apps"  on applications for select using (true);
-- 누구나 등록 (수정/삭제는 불가 → 삭제는 admin.sql의 비번 검증 함수로만)
drop policy if exists "public insert posts" on posts;
drop policy if exists "public insert apps"  on applications;
create policy "public insert posts" on posts        for insert with check (true);
create policy "public insert apps"  on applications for insert with check (true);

-- 4) 의견/기능 요청: 어떤 기능이 개선되면 좋을지 (수요 데이터)
create table if not exists feedback (
  id          bigint generated always as identity primary key,
  features    text,               -- 콤마로 선택된 기능들
  etc         text,               -- 자유 의견(선택)
  created_at  timestamptz default now()
);
alter table feedback enable row level security;
drop policy if exists "public read fb"   on feedback;
drop policy if exists "public insert fb" on feedback;
create policy "public read fb"   on feedback for select using (true);
create policy "public insert fb" on feedback for insert with check (true);

-- 최신순 조회 최적화
create index if not exists posts_created_idx on posts (created_at desc);
create index if not exists apps_post_idx     on applications (post_id);
