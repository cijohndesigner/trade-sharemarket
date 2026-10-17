/* Redirect direct visits to trading pages unless Supabase session is approved. */
(async function () {
  const path = location.pathname.split("/").pop();
  const openPages = ["index.html", "auth-login.html", "auth-signup.html", "auth-forgot-password.html"];
  if (openPages.includes(path)) return;
  const goLogin = () => { location.replace("auth-login.html"); };
  if (!window.CJ_SUPABASE) { goLogin(); return; }
  try {
    const { data: { session }, error } = await window.CJ_SUPABASE.auth.getSession();
    if (error || !session) { goLogin(); return; }
    const { data, error: accessError } = await window.CJ_SUPABASE.from("member_access")
      .select("status").eq("user_id", session.user.id).maybeSingle();
    if (accessError || !data || String(data.status).toLowerCase() !== "approved") {
      await window.CJ_SUPABASE.auth.signOut();
      goLogin();
      return;
    }

    document.documentElement.classList.add("auth-approved");
    // Add a small sign-out control without changing the existing dashboard layout.
    const titlebar = document.querySelector(".mac-titlebar");
    if (titlebar && !document.getElementById("cjAuthSignOut")) {
      const btn = document.createElement("button");
      btn.id = "cjAuthSignOut";
      btn.type = "button";
      btn.textContent = "Sign out";
      btn.style.cssText = "margin-left:10px;border:1px solid #c4b5fd;border-radius:999px;padding:5px 10px;background:rgba(255,255,255,.72);color:#5b21b6;font:600 12px Inter, sans-serif;cursor:pointer;white-space:nowrap";
      btn.addEventListener("click", async () => {
        await window.CJ_SUPABASE.auth.signOut();
        location.replace("auth-login.html");
      });
      titlebar.appendChild(btn);
    }
  } catch (_) { goLogin(); }
})();
