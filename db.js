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
  // 크루의 현재 고리 수, 최고 기록, 치킨(미달 누적)을 인증 이력에서 계산.
  // 규칙: 인증 1회 = 고리 +1. 완료된 주에 활성 멤버 중 목표 미달자가 1명이라도 있으면 사슬 절단(0).
  function computeChain(crew, members, checkins, nowTs) {
    const goal = Number(crew.goal) || 3;
    const workoutMembers = (members || []).filter(m => m.role !== "guardian");
    const memberIds = new Set(workoutMembers.map(m => String(m.id)));
    const workouts = (checkins || []).filter(c =>
      (c.type || "workout") === "workout" && memberIds.has(String(c.member_id)));
    const now = nowTs || Date.now();
    const nowWk = weekStartTs(now);
    const startWk = weekStartTs(crew.created_at);

    const byWeek = {};
    for (const c of workouts) {
      const wk = weekStartTs(c.created_at);
      const w = (byWeek[wk] = byWeek[wk] || { counts: {}, total: 0 });
      w.counts[c.member_id] = (w.counts[c.member_id] || 0) + 1;
      w.total++;
    }

    let chain = 0, best = 0, chicken = 0, brokeAt = null;
    for (let wk = startWk; wk <= nowWk; wk += WEEK_MS) {
      const w = byWeek[wk] || { counts: {}, total: 0 };
      const weekEnd = wk + WEEK_MS;
      const active = workoutMembers.filter(m => new Date(m.created_at).getTime() < weekEnd);
      if (wk < nowWk) {
        // 완료된 주 정산
        const misses = active.filter(m => (w.counts[m.id] || 0) < goal);
        if (active.length > 0 && misses.length === 0) {
          chain += w.total; best = Math.max(best, chain);
        } else {
          chicken += misses.length; best = Math.max(best, chain);
          if (chain > 0) brokeAt = chain;
          chain = 0;
        }
      } else {
        // 진행 중인 이번 주: 잠정 합산
        chain += w.total; best = Math.max(best, chain);
      }
    }
    return { chain, best, chicken, brokeAt };
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

  async function createCrew({ name, goal, ownerName, userId }) {
    await ready;
    goal = Number(goal) || 3;
    if (sb) {
      // 코드 충돌 시 몇 번 재시도
      let crew = null, err = null;
      for (let i = 0; i < 6 && !crew; i++) {
        const r = await sb.from("crews").insert({ name, code: genCode(), goal }).select().single();
        if (!r.error) crew = r.data; else err = r.error;
      }
      if (!crew) throw err || new Error("크루 생성 실패");
      const m = await sb.from("members").insert({ crew_id: crew.id, name: ownerName, role: "member", user_id: userId || null }).select().single();
      if (m.error) throw m.error;
      return { crew, member: m.data };
    }
    const crews = getLS(LS.crews);
    const crew = { id: uid(), name, code: genCode(), goal, created_at: new Date().toISOString() };
    crews.push(crew); setLS(LS.crews, crews);
    const member = await addMemberLocal(crew.id, ownerName, "member");
    return { crew, member };
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

  async function addMemberLocal(crewId, name, role) {
    const members = getLS(LS.members);
    const m = { id: uid(), crew_id: crewId, name, role, created_at: new Date().toISOString() };
    members.push(m); setLS(LS.members, members);
    return m;
  }

  async function joinCrew({ code, name, role, userId }) {
    await ready;
    const crew = await getCrewByCode(code);
    if (!crew) return { error: "코드에 해당하는 크루가 없어요" };
    if (sb) {
      const m = await sb.from("members").insert({ crew_id: crew.id, name, role: role || "member", user_id: userId || null }).select().single();
      if (m.error) throw m.error;
      return { crew, member: m.data };
    }
    const member = await addMemberLocal(crew.id, name, role || "member");
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

  async function addCheckin({ crewId, memberId, name, type, part, note, photo }) {
    await ready;
    const row = { crew_id: crewId, member_id: memberId, name, type: type || "workout", part: part || "", note: note || "", photo: photo || "" };
    if (sb) {
      const { data, error } = await sb.from("checkins").insert(row).select().single();
      if (error) throw error;
      return data;
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

  async function getProfile(id) {
    await ready;
    if (sb) { const { data, error } = await sb.from("profiles").select("*").eq("id", id).maybeSingle(); if (error) throw error; return data; }
    try { return JSON.parse(localStorage.getItem("sasl_profile_local") || "null"); } catch { return null; }
  }
  async function upsertProfile(p) {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("profiles").upsert({ id: p.id, nickname: p.nickname, avatar: p.avatar || "", bio: p.bio || "" }).select().single();
      if (error) throw error; return data;
    }
    const row = { id: "local", nickname: p.nickname, avatar: p.avatar || "", bio: p.bio || "" };
    localStorage.setItem("sasl_profile_local", JSON.stringify(row)); return row;
  }

  // 내가 속한 크루 목록 (계정 기준 → 다른 기기에서도 동일)
  async function getMyCrews(userId) {
    await ready;
    if (sb) {
      const { data, error } = await sb.from("members")
        .select("id,role,name,crew_id,crews(id,name,code,goal,created_at)")
        .eq("user_id", userId).order("id", { ascending: false });
      if (error) throw error;
      return (data || []).filter(m => m.crews).map(m => ({
        crewId: m.crews.id, memberId: m.id, role: m.role, name: m.name,
        code: m.crews.code, crewName: m.crews.name,
      }));
    }
    try { return JSON.parse(localStorage.getItem("sasl_me") || "[]"); } catch { return []; }
  }

  async function mode() { await ready; return sb ? "supabase" : "local"; }

  window.DB = { ready, addPost, listPosts, addApplication, listApplications,
                deletePost, deleteApplication, deleteAll,
                addFeedback, listFeedback,
                createCrew, getCrewByCode, getCrew, joinCrew, getMembers, getCheckins, addCheckin,
                listAllCrews, listAllMembers, listAllCheckins,
                signUp, signIn, signOut, currentUser, onAuth, getProfile, upsertProfile, getMyCrews,
                computeChain, weekStartTs, mode };
})();
