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
  const LS = { posts: "soechin_posts", apps: "soechin_apps" };
  const getLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
  const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

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

  async function mode() { await ready; return sb ? "supabase" : "local"; }

  window.DB = { ready, addPost, listPosts, addApplication, listApplications,
                deletePost, deleteApplication, deleteAll, mode };
})();
