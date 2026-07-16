-- ===== 쇠사슬 백엔드 스키마 (크루 지속 앱) =====
-- Supabase → SQL Editor 에 붙여넣고 Run. (기존 쇠친 테이블과 별개, 함께 있어도 무방)

-- 1) 크루: 아는 사람끼리 만드는 운동 조. code로 초대.
create table if not exists crews (
  id          bigint generated always as identity primary key,
  name        text not null,
  code        text not null unique,     -- 초대 코드 (예: "K3F9")
  goal        int  not null default 3,  -- 주간 목표 인증 횟수 (1인당)
  created_at  timestamptz default now()
);

-- 2) 멤버: 크루원(운동) 또는 가디언(응원만)
create table if not exists members (
  id          bigint generated always as identity primary key,
  crew_id     bigint references crews(id) on delete cascade,
  name        text not null,
  role        text not null default 'member',  -- 'member' | 'guardian'
  created_at  timestamptz default now()
);

-- 3) 인증/이벤트: 운동 인증(고리+1), 운동 시작(라이브 타이머), 응원
create table if not exists checkins (
  id          bigint generated always as identity primary key,
  crew_id     bigint references crews(id) on delete cascade,
  member_id   bigint references members(id) on delete cascade,
  name        text,
  type        text not null default 'workout', -- 'workout' | 'start' | 'cheer'
  part        text,      -- 운동 부위 / 응원 스티커
  note        text,      -- 감정·한마디
  photo       text,      -- 인증샷 (압축된 data URL)
  created_at  timestamptz default now()
);
-- 기존 테이블이 있으면 photo 컬럼만 추가 (재실행 안전)
alter table checkins add column if not exists photo text;

-- RLS: 익명 사용자가 읽기 + 등록(insert)만. 수정/삭제 불가.
alter table crews    enable row level security;
alter table members  enable row level security;
alter table checkins enable row level security;

drop policy if exists "read crews"    on crews;
drop policy if exists "insert crews"   on crews;
drop policy if exists "read members"   on members;
drop policy if exists "insert members" on members;
drop policy if exists "read checkins"  on checkins;
drop policy if exists "insert checkins" on checkins;

create policy "read crews"     on crews    for select using (true);
create policy "insert crews"    on crews    for insert with check (true);
create policy "read members"    on members  for select using (true);
create policy "insert members"  on members  for insert with check (true);
create policy "read checkins"   on checkins for select using (true);
create policy "insert checkins" on checkins for insert with check (true);

-- v2: 크루 유형(친구/팀) + 하드모드(옵트인 벌금)
alter table crews add column if not exists type     text default 'friend';   -- 'friend' | 'team'
alter table crews add column if not exists hardmode boolean default false;
alter table crews add column if not exists penalty  int default 0;
-- 설정 변경(목표·하드모드) 반영을 위해 update 허용
drop policy if exists "update crews" on crews;
create policy "update crews" on crews for update using (true) with check (true);

create index if not exists members_crew_idx  on members (crew_id);
create index if not exists checkins_crew_idx  on checkins (crew_id, created_at desc);
