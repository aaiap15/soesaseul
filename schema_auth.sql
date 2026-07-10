-- ===== 쇠사슬 계정/프로필 (Supabase Auth 연동) =====
-- Supabase → SQL Editor 에 붙여넣고 Run.
-- ⚠️ 추가로: Authentication → Sign In / Providers → Email 에서
--    "Confirm email"(이메일 확인)을 끄면 회원가입 즉시 로그인됩니다(테스트 편의).

-- 프로필: auth 사용자와 1:1
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null,
  avatar      text,               -- 압축된 프로필 사진 data URL
  bio         text,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
drop policy if exists "read profiles"       on profiles;
drop policy if exists "insert own profile"  on profiles;
drop policy if exists "update own profile"  on profiles;
create policy "read profiles"      on profiles for select using (true);
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- 멤버십을 계정과 연결 (다른 기기에서 로그인해도 내 크루가 뜨게)
alter table members add column if not exists user_id uuid;
create index if not exists members_user_idx on members (user_id);
