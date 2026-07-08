-- ===== 쇠친 운영자 삭제 기능 (비밀번호 검증형 RPC) =====
-- 왜 필요? anon(공개) 키에 삭제 권한을 열면 아무나 데이터를 지울 수 있어 위험.
-- 그래서 서버에서 비밀번호를 검증하는 함수를 만들고, 운영자 화면에서 비번 입력 시에만 삭제.
--
-- ⚠️ 사용법:
--   1) 아래 'CHANGE_ME_바꾸세요' 3곳을 원하는 운영자 비밀번호로 바꾸세요.
--   2) Supabase → SQL Editor 에 붙여넣고 Run.
--   3) admin.html 에서 삭제 시 이 비밀번호를 입력하면 됩니다.
--   (⚠️ 실제 비밀번호는 GitHub 레포에 커밋하지 마세요. 이 파일은 템플릿입니다.)

-- 모집글 1개 삭제 (연결된 신청도 FK cascade로 함께 삭제)
create or replace function admin_delete_post(pw text, target_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  if pw is distinct from 'CHANGE_ME_바꾸세요' then raise exception 'unauthorized'; end if;
  delete from posts where id = target_id;
  return target_id;
end; $$;

-- 신청 1개 삭제
create or replace function admin_delete_application(pw text, target_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  if pw is distinct from 'CHANGE_ME_바꾸세요' then raise exception 'unauthorized'; end if;
  delete from applications where id = target_id;
  return target_id;
end; $$;

-- 전체 삭제
create or replace function admin_delete_all(pw text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if pw is distinct from 'CHANGE_ME_바꾸세요' then raise exception 'unauthorized'; end if;
  delete from applications where true;  -- WHERE 없으면 sql_safe_updates가 막음
  delete from posts where true;
end; $$;

-- 권한: public 회수 후 anon 에게만 실행 허용 (실제 삭제는 함수 내부 비번 검증을 통과해야 함)
revoke all on function admin_delete_post(text, bigint)        from public;
revoke all on function admin_delete_application(text, bigint) from public;
revoke all on function admin_delete_all(text)                 from public;
grant execute on function admin_delete_post(text, bigint)        to anon;
grant execute on function admin_delete_application(text, bigint) to anon;
grant execute on function admin_delete_all(text)                 to anon;
