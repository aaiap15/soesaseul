// ===== 쇠친 데이터 계층 =====
// Supabase가 설정돼 있으면 공용 DB, 없으면 localStorage로 자동 폴백.
// index.html / admin.html 이 window.DB 로 공통 사용.
(function () {
  const cfg = window.SOECHIN_CONFIG || {};
  let sb = null;

  const ready = (async () => {
    if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
      try {
        const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
        sb = mod.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      } catch (e) {
        console.warn("Supabase 로드 실패 → 로컬 저장으로 폴백", e);
        sb = null;
      }
    }
  })();

  // ---- localStorage 헬퍼 ----
  const LS = { posts: "soechin_posts", apps: "soechin_apps", fb: "soechin_fb",
               crews: "sasl_crews", members: "sasl_members", checkins: "sasl_checkins" };
  const getLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
  const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

  // ---- 쇠사슬 계산 (앱/운영자 공용 · 순수함수) ----
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  function weekStartTs(dateLike) {           // 그 주 월요일 00:00(로컬) 타임스탬프
    const x = new Date(dateLike);
    x.setHours(0, 0, 0, 0);
    const dow = (x.getDay() + 6) % 7;        // 월=0 … 일=6
    x.setDate(x.getDate() - dow);
    return x.getTime();
  }
  // 사슬 = 크루 누적 인증 (리셋 없음, 절대 안 뺏김). 긴장감은 쇠붕이 컨디션이 담당.
  // 고리 = 크루원(가디언 제외) 운동 인증의 총합.
  function computeChain(crew, members, checkins) {
    const workoutMembers = (members || []).filter(m => m.role !== "guardian");
    const ids = new Set(workoutMembers.map(m => String(m.id)));
    const total = (checkins || []).filter(c =>
      (c.type || "workout") === "workout" && ids.has(String(c.member_id))).length;
    // best는 하위호환용(항상 total). chicken은 하드모드에서만 별도 계산.
    return { chain: total, best: total, chicken: 0 };
  }

  // ---- 공통 API ----
  async function addPost(p) {
    await ready;
    const row = { name: p.name, age: p.age, gender: p.gender, part: p.part, contact: p.contact || "", note: p.note || "" };
    if (sb) {
      const { data, error } = await sb.from("posts").insert(row).select().single();
      if (error) throw error;
      return data;
    }
    const rows = getLS(LS.posts);
    row.id = uid(); row.created_at = new Date().toISOString();
    rows.push(row); setLS(LS.posts, rows);
    return row;
  }

  async function listPosts() {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("posts").select("*").order("id", { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return getLS(LS.posts).sort((a, b) => b.id - a.id);
  }

  async function addApplication(a) {
    await ready;
    const row = { post_id: a.post_id, name: a.name, contact: a.contact || "" };
    if (sb) {
      const { data, error } = await sb.from("applications").insert(row).select().single();
      if (error) throw error;
      return data;
    }
    const rows = getLS(LS.apps);
    row.id = uid(); row.created_at = new Date().toISOString();
    rows.push(row); setLS(LS.apps, rows);
    return row;
  }

  async function listApplications() {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("applications").select("*").order("id", { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return getLS(LS.apps).sort((a, b) => b.id - a.id);
  }

  // ---- 삭제 (운영자 전용) ----
  // Supabase 모드: 서버측 비번 검증 RPC 호출 (admin.sql). 로컬 모드: 그냥 localStorage에서 제거.
  async function deletePost(id, pw) {
    await ready;
    if (sb) {
      const { error } = await sb.rpc("admin_delete_post", { pw, target_id: id });
      if (error) throw error;
    } else {
      setLS(LS.posts, getLS(LS.posts).filter(p => String(p.id) !== String(id)));
      setLS(LS.apps,  getLS(LS.apps).filter(a => String(a.post_id) !== String(id)));
    }
  }
  async function deleteApplication(id, pw) {
    await ready;
    if (sb) {
      const { error } = await sb.rpc("admin_delete_application", { pw, target_id: id });
      if (error) throw error;
    } else {
      setLS(LS.apps, getLS(LS.apps).filter(a => String(a.id) !== String(id)));
    }
  }
  async function deleteAll(pw) {
    await ready;
    if (sb) {
      // WHERE 없는 전체 DELETE는 Supabase(sql_safe_updates)가 막으므로,
      // 글 단위로 삭제(각 글은 WHERE 있음, 신청은 FK cascade로 함께 제거).
      const all = await listPosts();
      for (const p of all) {
        const { error } = await sb.rpc("admin_delete_post", { pw, target_id: p.id });
        if (error) throw error;
      }
    } else {
      setLS(LS.posts, []); setLS(LS.apps, []);
    }
  }

  // ---- 의견/기능 요청 ----
  async function addFeedback(f) {
    await ready;
    const row = { features: f.features || "", etc: f.etc || "" };
    if (sb) {
      const { data, error } = await sb.from("feedback").insert(row).select().single();
      if (error) throw error;
      return data;
    }
    const rows = getLS(LS.fb);
    row.id = uid(); row.created_at = new Date().toISOString();
    rows.push(row); setLS(LS.fb, rows);
    return row;
  }
  async function listFeedback() {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("feedback").select("*").order("id", { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return getLS(LS.fb).sort((a, b) => b.id - a.id);
  }

  // ================= 쇠사슬: 크루 =================
  const genCode = () => {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 글자 제외
    let s = ""; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  };

  // 멤버 insert (pin/owner_key 컬럼 없는 DB면 자동으로 빼고 재시도)
  async function insertMemberSb(row) {
    let r = await sb.from("members").insert(row).select().single();
    if (r.error && /pin|owner_key|jersey_no|schema cache|column/i.test(r.error.message || "")) {
      const { pin, owner_key, jersey_no, ...rest } = row;
      r = await sb.from("members").insert(rest).select().single();
    }
    return r;
  }

  async function createCrew({ name, goal, ownerName, userId, type, pin, ownerKey, jersey }) {
    await ready;
    goal = Number(goal) || 3;
    type = type || "friend";
    if (sb) {
      // 코드 충돌 시 몇 번 재시도. type/hardmode 컬럼이 아직 없는 DB면 자동으로 빼고 생성(하위호환).
      let crew = null, err = null;
      for (let i = 0; i < 6 && !crew; i++) {
        let r = await sb.from("crews").insert({ name, code: genCode(), goal, type }).select().single();
        if (r.error && /type|hardmode|penalty|color|chant|emblem|schema cache|column/i.test(r.error.message || "")) {
          r = await sb.from("crews").insert({ name, code: genCode(), goal }).select().single();
        }
        if (!r.error) crew = r.data; else err = r.error;
      }
      if (!crew) throw err || new Error("크루 생성 실패");
      const m = await insertMemberSb({ crew_id: crew.id, name: ownerName, role: "member", user_id: userId || null, pin: pin || null, owner_key: ownerKey || null, jersey_no: jersey || null });
      if (m.error) throw m.error;
      return { crew, member: m.data };
    }
    const crews = getLS(LS.crews);
    const crew = { id: uid(), name, code: genCode(), goal, type, created_at: new Date().toISOString() };
    crews.push(crew); setLS(LS.crews, crews);
    const member = await addMemberLocal(crew.id, ownerName, "member", pin, jersey);
    return { crew, member };
  }

  async function updateCrew(id, patch) {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("crews").update(patch).eq("id", id).select().single();
      if (error) throw error; return data;
    }
    const crews = getLS(LS.crews); const i = crews.findIndex(c => String(c.id) === String(id));
    if (i >= 0) { crews[i] = { ...crews[i], ...patch }; setLS(LS.crews, crews); return crews[i]; }
    return null;
  }

  async function updateMember(id, patch) {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("members").update(patch).eq("id", id).select().single();
      if (error) throw error; return data;
    }
    const ms = getLS(LS.members); const i = ms.findIndex(m => String(m.id) === String(id));
    if (i >= 0) { ms[i] = { ...ms[i], ...patch }; setLS(LS.members, ms); return ms[i]; }
    return null;
  }

  async function getCrewByCode(code) {
    await ready;
    code = (code || "").trim().toUpperCase();
    if (sb) {
      const { data, error } = await sb.from("crews").select("*").eq("code", code).maybeSingle();
      if (error) throw error;
      return data;
    }
    return getLS(LS.crews).find(c => c.code === code) || null;
  }

  async function getCrew(id) {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("crews").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    }
    return getLS(LS.crews).find(c => String(c.id) === String(id)) || null;
  }

  async function addMemberLocal(crewId, name, role, pin, jersey) {
    const members = getLS(LS.members);
    const m = { id: uid(), crew_id: crewId, name, role, pin: pin || null, jersey_no: jersey || null, created_at: new Date().toISOString() };
    members.push(m); setLS(LS.members, members);
    return m;
  }

  async function joinCrew({ code, name, role, userId, pin, ownerKey, jersey }) {
    await ready;
    const crew = await getCrewByCode(code);
    if (!crew) return { error: "코드에 해당하는 크루가 없어요" };
    if (sb) {
      const m = await insertMemberSb({ crew_id: crew.id, name, role: role || "member", user_id: userId || null, pin: pin || null, owner_key: ownerKey || null, jersey_no: jersey || null });
      if (m.error) throw m.error;
      return { crew, member: m.data };
    }
    const member = await addMemberLocal(crew.id, name, role || "member", pin, jersey);
    return { crew, member };
  }

  async function getMembers(crewId) {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("members").select("*").eq("crew_id", crewId).order("id");
      if (error) throw error;
      return data || [];
    }
    return getLS(LS.members).filter(m => String(m.crew_id) === String(crewId));
  }

  async function getCheckins(crewId) {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("checkins").select("*").eq("crew_id", crewId).order("id", { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return getLS(LS.checkins).filter(c => String(c.crew_id) === String(crewId)).sort((a, b) => b.id - a.id);
  }

  async function addCheckin({ crewId, memberId, name, type, part, note, photo, distanceKm }) {
    await ready;
    const row = { crew_id: crewId, member_id: memberId, name, type: type || "workout", part: part || "", note: note || "", photo: photo || "" };
    if (distanceKm != null && distanceKm !== "") row.distance_km = Number(distanceKm) || null;
    if (sb) {
      let r = await sb.from("checkins").insert(row).select().single();
      if (r.error && /distance_km|schema cache|column/i.test(r.error.message || "")) {
        const { distance_km, ...rest } = row;
        r = await sb.from("checkins").insert(rest).select().single();
      }
      if (r.error) throw r.error;
      return r.data;
    }
    const rows = getLS(LS.checkins);
    row.id = uid(); row.created_at = new Date().toISOString();
    rows.push(row); setLS(LS.checkins, rows);
    return row;
  }

  async function listAllCrews() {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("crews").select("*").order("id", { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return getLS(LS.crews).sort((a, b) => b.id - a.id);
  }
  async function listAllMembers() {
    await ready;
    if (sb) { const { data, error } = await sb.from("members").select("*"); if (error) throw error; return data || []; }
    return getLS(LS.members);
  }
  async function listAllCheckins() {
    await ready;
    if (sb) { const { data, error } = await sb.from("checkins").select("*"); if (error) throw error; return data || []; }
    return getLS(LS.checkins);
  }

  // ================= 계정 / 프로필 =================
  async function signUp(email, password) {
    await ready; if (!sb) throw new Error("로컬 모드에선 회원가입이 없어요");
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error; return data;
  }
  async function signIn(email, password) {
    await ready; if (!sb) throw new Error("로컬 모드");
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error; return data;
  }
  async function signOut() { await ready; if (sb) await sb.auth.signOut(); localStorage.removeItem("sasl_profile_local"); }
  async function currentUser() {
    await ready;
    if (!sb) return { id: "local" };
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.user : null;
  }
  function onAuth(cb) { if (sb) sb.auth.onAuthStateChange((_e, session) => cb(session ? session.user : null)); }

  // 로그인 없이 사용 → 프로필은 이 기기(localStorage)에만 저장
  async function getProfile() {
    try { return JSON.parse(localStorage.getItem("sasl_profile_local") || "null"); } catch { return null; }
  }
  async function upsertProfile(p) {
    // 정체성 키 = 닉네임#PIN → 어느 기기서든 이 키로 내 크루를 불러옴
    const id = (p.nickname && p.pin) ? `${p.nickname}#${p.pin}` : "local";
    const row = { id, nickname: p.nickname, pin: p.pin || "", avatar: p.avatar || "", bio: p.bio || "" };
    localStorage.setItem("sasl_profile_local", JSON.stringify(row)); return row;
  }

  // 내가 속한 크루 목록 (owner_key=닉네임#PIN 기준 → 다른 기기·재접속에도 동일)
  async function getMyCrews(ownerKey) {
    await ready;
    if (sb && ownerKey && ownerKey !== "local") {
      const { data, error } = await sb.from("members")
        .select("id,role,name,crew_id,crews(id,name,code,goal,created_at)")
        .eq("owner_key", ownerKey).order("id", { ascending: false });
      if (error) return [];
      return (data || []).filter(m => m.crews).map(m => ({
        crewId: m.crews.id, memberId: m.id, role: m.role, name: m.name,
        code: m.crews.code, crewName: m.crews.name,
      }));
    }
    return [];
  }

  async function mode() { await ready; return sb ? "supabase" : "local"; }

  window.DB = { ready, addPost, listPosts, addApplication, listApplications,
                deletePost, deleteApplication, deleteAll,
                addFeedback, listFeedback,
                createCrew, updateCrew, updateMember, getCrewByCode, getCrew, joinCrew, getMembers, getCheckins, addCheckin,
                listAllCrews, listAllMembers, listAllCheckins,
                signUp, signIn, signOut, currentUser, onAuth, getProfile, upsertProfile, getMyCrews,
                computeChain, weekStartTs, mode };
})();
