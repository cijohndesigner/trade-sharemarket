/* Public browser configuration. Never put a Supabase secret/service-role key here. */
window.CJ_SUPABASE_URL = "https://rstadgblajptxpdnobzn.supabase.co";
/* Paste your COMPLETE sb_publishable_... key from Supabase > Settings > API Keys. */
window.CJ_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Xlki28VVR4SC6rPlbRSBCg_IbVRwPXk";
window.CJ_AUTH_EMAIL_DOMAIN = "cjcruz.com";
window.CJ_SUPABASE = null;
(function () {
  if (!window.supabase || !window.CJ_SUPABASE_URL ||
      !window.CJ_SUPABASE_PUBLISHABLE_KEY ||
      window.CJ_SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR")) return;
  window.CJ_SUPABASE = window.supabase.createClient(
    window.CJ_SUPABASE_URL,
    window.CJ_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
})();
