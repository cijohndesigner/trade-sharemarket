
/* CJ Cruz Trade Tracker — Member and Admin Authentication */
(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const client = () => window.CJ_SUPABASE;

  const LOGIN = "auth-login.html";
  const UPDATE = "auth-update-password.html";
  const DASHBOARD = "dashboard.html";
  const ADMIN_PAGE = "admin-members.html";

  const isAdminMode = () =>
    new URLSearchParams(location.search).get("mode") === "admin";

  function pageName() {
    return location.pathname.split("/").pop().toLowerCase();
  }

  function message(text, type = "error") {
    const el = $("[data-auth-message]");
    if (!el) {
      console.log(text);
      return;
    }

    el.textContent = text;
    el.className = "auth-message show " + type;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
  }

  function usernameEmail(username) {
    const domain = String(window.CJ_AUTH_EMAIL_DOMAIN || "")
      .trim().toLowerCase();

    if (!domain) {
      throw new Error("Missing CJ_AUTH_EMAIL_DOMAIN in supabase-config.js.");
    }

    return username.toLowerCase() + "@" + domain;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function normalizeUsername(value) {
    const username = String(value || "").trim().toLowerCase();

    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      throw new Error("Enter a valid username.");
    }

    return username;
  }

  function formType(form) {
    const page = pageName();
    const has = name => !!$('[name="' + name + '"]', form);

    if (page === UPDATE) return "update";
    if (page === "auth-signup.html") return "signup";
    if (page === "auth-forgot-password.html") return "forgot";
    if (page === LOGIN) return "login";

    if (has("confirmPassword") && has("username")) return "signup";
    if (has("confirmPassword") && has("password")) return "update";
    if (has("email") && !has("password")) return "forgot";
    if (has("username") && has("password")) return "login";

    return "unknown";
  }

  async function isAdmin(auth) {
    const { data, error } = await auth.rpc("is_app_admin");

    if (error) {
      throw new Error(
        "Could not verify administrator permissions. Check the is_app_admin() function."
      );
    }

    return data === true;
  }

  async function getStatus(auth, userId) {
    const { data, error } = await auth
      .from("member_access")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    return String(data?.status || "pending").toLowerCase();
  }

  async function login(auth, formData) {
    const entered = String(
      formData.get("username") || formData.get("email") || ""
    ).trim();

    const password = String(formData.get("password") || "");

    if (!entered || !password) {
      throw new Error("Enter your username/email and password.");
    }

    // Gmail login works for accounts registered with their real Gmail.
    // Username login uses the configured synthetic email.
    const email = entered.includes("@")
      ? entered.toLowerCase()
      : usernameEmail(normalizeUsername(entered));

    if (!validEmail(email)) {
      throw new Error("Enter a valid email address or username.");
    }

    const { data, error } = await auth.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (/invalid login credentials/i.test(error.message || "")) {
        throw new Error("Username/email or password is incorrect.");
      }

      if (/email not confirmed/i.test(error.message || "")) {
        throw new Error("Your account email is not confirmed.");
      }

      throw error;
    }

    let admin;

    try {
      admin = await isAdmin(auth);
    } catch (err) {
      await auth.auth.signOut();
      throw err;
    }

    if (isAdminMode()) {
      if (!admin) {
        await auth.auth.signOut();
        throw new Error("Admin access denied. This account is not an authorized administrator.");
      }

      location.replace(ADMIN_PAGE);
      return;
    }

    // Do not let an administrator enter through the normal member login.
    if (admin) {
      await auth.auth.signOut();
      throw new Error("This is an administrator account. Please use Admin Login.");
    }

    const status = await getStatus(auth, data.user.id);

    if (status !== "approved") {
      await auth.auth.signOut();

      const messages = {
        pending: "Your account is waiting for administrator approval.",
        rejected: "Your access request was rejected.",
        suspended: "Your account is suspended."
      };

      throw new Error(messages[status] || "Your account is not approved.");
    }

    location.replace(DASHBOARD);
  }

  async function signup(auth, formData) {
    const username = normalizeUsername(formData.get("username"));
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password.length < 10) {
      throw new Error("Use a password with at least 10 characters.");
    }

    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    const { data, error } = await auth.auth.signUp({
      email: usernameEmail(username),
      password,
      options: {
        data: {
          username,
          display_name: username,
          full_name: username
        }
      }
    });

    if (error) throw error;
    if (!data?.user) throw new Error("Supabase did not return a user.");

    if (!data.session) {
      message(
        "Account creation may have succeeded, but no session was created. Ask the administrator to check Supabase email-confirmation settings."
      );
      return;
    }

    const { error: accessError } = await auth
      .from("member_access")
      .insert({
        user_id: data.user.id,
        username,
        status: "pending",
        updated_at: new Date().toISOString()
      });

    if (accessError) {
      await auth.auth.signOut();
      throw new Error(
        "Account created, but the approval record could not be saved. " +
        accessError.message
      );
    }

    await auth.auth.signOut();
    message("Account created. Wait for administrator approval.", "success");

    setTimeout(() => {
      location.replace(LOGIN);
    }, 1500);
  }

  async function forgotPassword(auth, formData) {
    const email = String(formData.get("email") || "")
      .trim().toLowerCase();

    if (!validEmail(email)) {
      throw new Error("Enter your registered Gmail address.");
    }

    const redirectTo = new URL(UPDATE, location.href).href;

    const { error } = await auth.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) throw error;

    message(
      "If this email is registered, a reset link will be sent. Open the newest email.",
      "success"
    );
  }

  async function initialiseRecovery(auth) {
    if (pageName() !== UPDATE) return;

    try {
      const url = new URL(location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const code = url.searchParams.get("code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type");

      if (
        url.searchParams.has("error") ||
        hash.has("error") ||
        hash.has("error_description")
      ) {
        throw new Error("Reset link invalid or expired. Request a fresh email.");
      }

      if (code) {
        const { error } = await auth.auth.exchangeCodeForSession(code);
        if (error) throw error;

        url.searchParams.delete("code");
        history.replaceState(
          {},
          document.title,
          url.pathname + url.search + url.hash
        );

        message("Reset link verified. Enter your new password.", "success");
        return;
      }

      if (accessToken && refreshToken) {
        if (type && type !== "recovery") {
          throw new Error("This is not a password recovery link.");
        }

        const { error } = await auth.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) throw error;

        history.replaceState({}, document.title, url.pathname + url.search);
        message("Reset link verified. Enter your new password.", "success");
        return;
      }

      const { data, error } = await auth.auth.getSession();
      if (error) throw error;

      if (data?.session) {
        message("Recovery session found. Enter your new password.", "success");
      } else {
        message("No valid reset session. Request a fresh reset email.");
      }
    } catch (err) {
      console.error("Recovery error:", err);
      message(err.message || "Could not verify the reset link.");
    }
  }

  async function updatePassword(auth, formData) {
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password.length < 10) {
      throw new Error("Use a password with at least 10 characters.");
    }

    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    const { data, error: sessionError } = await auth.auth.getSession();
    if (sessionError) throw sessionError;

    if (!data?.session) {
      throw new Error("Reset session missing or expired. Request a fresh reset email.");
    }

    const { error } = await auth.auth.updateUser({ password });
    if (error) throw error;

    message("Password updated. Returning to sign in…", "success");

    // The reset session is not an admin grant.
    setTimeout(() => {
      location.replace(LOGIN);
    }, 1500);
  }

  async function submit(form) {
    const auth = client();

    if (!auth) {
      message("Supabase is not configured. Check js/supabase-config.js.");
      return;
    }

    const type = formType(form);
    const formData = new FormData(form);
    const button = $('button[type="submit"]', form);
    const originalText = button?.textContent || "Continue";

    if (button) {
      button.disabled = true;
      button.textContent = "Please wait…";
    }

    try {
      if (type === "login") await login(auth, formData);
      else if (type === "signup") await signup(auth, formData);
      else if (type === "forgot") await forgotPassword(auth, formData);
      else if (type === "update") await updatePassword(auth, formData);
      else throw new Error("Could not identify this authentication form.");
    } catch (err) {
      console.error("Authentication error:", err);
      message(err.message || "Something went wrong.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const auth = client();

    if (auth) initialiseRecovery(auth);

    // Change the sign-in heading when Admin Login mode is active.
    if (pageName() === LOGIN && isAdminMode()) {
      const heading = $("h1");
      const eyebrow = $(".auth-eyebrow");
      const intro = $(".auth-intro");

      if (heading) heading.textContent = "Administrator sign in";
      if (eyebrow) eyebrow.textContent = "✦ Secure admin access";
      if (intro) intro.textContent =
        "Sign in with an authorized administrator account.";
    }

    document.querySelectorAll("[data-auth-form]").forEach(form => {
      if (form.dataset.authHandlerAttached === "true") return;
      form.dataset.authHandlerAttached = "true";

      form.addEventListener("submit", event => {
        event.preventDefault();
        submit(form);
      });
    });
  });
})();
