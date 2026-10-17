
/*
 * CJ Cruz Trade Tracker — Authentication
 * Signup: username + password + confirm password
 * Login: username + password
 * Approval: pending / approved / rejected / suspended
 * Password reset: email recovery link or administrator-managed username reset.
 *
 * Supabase Auth uses a hidden synthetic email for username login.
 * Never expose the service-role key or store plaintext passwords.
 */

(function () {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const client = () => window.CJ_SUPABASE;

  function msg(text, type = "error") {
    const el = $("[data-auth-message]");
    if (!el) return;

    el.textContent = text;
    el.className = "auth-message show " + type;
    el.setAttribute("role", "status");
  }

  function pageName() {
    return location.pathname
      .replace(/\/+$/, "")
      .split("/")
      .pop()
      .toLowerCase();
  }

  function normalizeUsername(value) {
    const username = String(value || "")
      .trim()
      .toLowerCase();

    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      throw new Error(
        "Username must be 3–32 characters using letters, numbers, dots, underscores or hyphens."
      );
    }

    if (!window.CJ_AUTH_EMAIL_DOMAIN) {
      throw new Error(
        "Missing CJ_AUTH_EMAIL_DOMAIN in js/supabase-config.js."
      );
    }

    return username;
  }

  function usernameEmail(username) {
    return username + "@" +
      String(window.CJ_AUTH_EMAIL_DOMAIN).trim().toLowerCase();
  }

  function detectPage(form) {
    const page = pageName();
    const has = name => !!$('[name="' + name + '"]', form);

    if (page === "auth-update-password.html") {
      return "update";
    }

    if (page === "auth-signup.html" ||
        (has("username") && has("password") &&
         has("confirmPassword"))) {
      return "signup";
    }

    if (page === "auth-forgot-password.html" ||
        (has("email") && !has("password")) ||
        (has("username") && !has("password"))) {
      return "forgot";
    }

    if (page === "auth-login.html" ||
        (has("username") && has("password"))) {
      return "login";
    }

    if (has("password") && has("confirmPassword")) {
      return "update";
    }

    return "unknown";
  }

  async function getApprovalStatus(userId) {
    const { data, error } = await client()
      .from("member_access")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    return String(data?.status || "pending")
      .trim()
      .toLowerCase();
  }

  async function handleSignup(auth, formData) {
    const username = normalizeUsername(
      formData.get("username")
    );
    const password = String(formData.get("password") || "");
    const confirm = String(
      formData.get("confirmPassword") || ""
    );

    if (password.length < 10) {
      throw new Error(
        "Use a password with at least 10 characters."
      );
    }

    if (password !== confirm) {
      throw new Error("The passwords do not match.");
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

    if (!data?.user) {
      throw new Error("Supabase did not return a user.");
    }

    if (!data.session) {
      msg(
        "The account may have been created, but no session was started. Do not register again. Ask the administrator to check the existing account and email confirmation settings."
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
        "Account created, but the approval record could not be saved. Check member_access RLS policies. " +
        accessError.message
      );
    }

    await auth.auth.signOut();

    msg(
      "Account created. Your status is Pending until the administrator approves it.",
      "success"
    );

    setTimeout(() => {
      location.href = "auth-login.html";
    }, 1800);
  }

  async function handleLogin(auth, formData) {
    const username = normalizeUsername(
      formData.get("username")
    );
    const password = String(formData.get("password") || "");

    if (!password) {
      throw new Error("Enter your password.");
    }

    const { data, error } = await auth.auth.signInWithPassword({
      email: usernameEmail(username),
      password
    });

    if (error) {
      const reason = String(error.message || "").toLowerCase();

      if (reason.includes("email not confirmed")) {
        throw new Error(
          "This account is not confirmed. Ask the administrator to check the existing account in Supabase."
        );
      }

      if (reason.includes("invalid login credentials")) {
        throw new Error(
          "Username or password is incorrect."
        );
      }

      throw error;
    }

    let status;

    try {
      status = await getApprovalStatus(data.user.id);
    } catch (e) {
      await auth.auth.signOut();

      throw new Error(
        "Could not verify approval status. Check member_access and its SELECT policy. " +
        (e.message || "")
      );
    }

    if (status !== "approved") {
      await auth.auth.signOut();

      const messages = {
        pending: "Your account is waiting for administrator approval.",
        rejected: "Your access request was rejected.",
        suspended: "Your account is suspended."
      };

      throw new Error(
        messages[status] || "This account is not approved."
      );
    }

    location.href = "dashboard.html";
  }

  async function handleForgot(auth, formData) {
    const emailValue = formData.get("email");

    if (emailValue === null) {
      const username = normalizeUsername(
        formData.get("username")
      );

      msg(
        "Password reset for '" + username +
        "' must be handled by the CJ Cruz administrator. Verify the member's identity before resetting the password.",
        "success"
      );
      return;
    }

    const email = String(emailValue || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid registered email address.");
    }

    const redirectTo = new URL(
      "auth-update-password.html",
      location.href
    ).href;

    const { error } = await auth.auth.resetPasswordForEmail(
      email,
      { redirectTo }
    );

    if (error) throw error;

    msg(
      "If the email is registered, a reset link will be sent. Open the newest email in this browser.",
      "success"
    );
  }

  async function initialiseRecovery(auth) {
    if (pageName() !== "auth-update-password.html") return;

    try {
      const url = new URL(location.href);
      const params = new URLSearchParams(
        url.hash.replace(/^#/, "")
      );

      const code = url.searchParams.get("code");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (code) {
        const { error } =
          await auth.auth.exchangeCodeForSession(code);

        if (error) throw error;

        url.searchParams.delete("code");
        history.replaceState(
          {},
          document.title,
          url.pathname + url.search + url.hash
        );

        msg(
          "Reset link verified. Enter your new password.",
          "success"
        );
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await auth.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) throw error;

        history.replaceState(
          {},
          document.title,
          url.pathname + url.search
        );

        msg(
          "Reset link verified. Enter your new password.",
          "success"
        );
        return;
      }

      const { data, error } = await auth.auth.getSession();

      if (error) throw error;

      if (data?.session) {
        msg(
          "Recovery session found. Enter your new password.",
          "success"
        );
      } else {
        msg(
          "No valid reset session was found. Request a fresh reset email and open its newest link."
        );
      }
    } catch (error) {
      console.error("Recovery initialisation failed:", error);

      msg(
        "The reset link is invalid or expired. Request a fresh reset email."
      );
    }
  }

  async function handleUpdate(auth, formData) {
    const password = String(formData.get("password") || "");
    const confirm = String(
      formData.get("confirmPassword") || ""
    );

    if (password.length < 10) {
      throw new Error(
        "Use a password with at least 10 characters."
      );
    }

    if (password !== confirm) {
      throw new Error("The passwords do not match.");
    }

    const { data, error: sessionError } =
      await auth.auth.getSession();

    if (sessionError) throw sessionError;

    if (!data?.session) {
      throw new Error(
        "No valid reset session. Open the newest reset email link or request a fresh one."
      );
    }

    const { error } = await auth.auth.updateUser({
      password
    });

    if (error) throw error;

    await auth.auth.signOut();

    msg(
      "Password updated successfully. You can now sign in.",
      "success"
    );

    setTimeout(() => {
      location.href = "auth-login.html";
    }, 1800);
  }

  async function submit(form) {
    const auth = client();

    if (!auth) {
      msg(
        "Supabase is not configured. Check js/supabase-config.js."
      );
      return;
    }

    const page = detectPage(form);
    const formData = new FormData(form);
    const button = $('button[type="submit"]', form);

    if (button) {
      button.disabled = true;
      button.dataset.originalText ||= button.textContent;
      button.textContent = "Please wait…";
    }

    try {
      if (page === "signup") {
        await handleSignup(auth, formData);
      } else if (page === "login") {
        await handleLogin(auth, formData);
      } else if (page === "forgot") {
        await handleForgot(auth, formData);
      } else if (page === "update") {
        await handleUpdate(auth, formData);
      } else {
        throw new Error(
          "Could not identify this form. Check the page filename and input names."
        );
      }
    } catch (error) {
      console.error("Authentication error:", error);

      const message = String(
        error?.message || "Something went wrong."
      );

      if (
        /email signups are disabled|signups not allowed|email provider.*disabled/i.test(message)
      ) {
        msg(
          "Enable the Email provider in Supabase → Authentication → Sign In / Providers. For username signup, turn Confirm email OFF."
        );
      } else {
        msg(message);
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent =
          button.dataset.originalText || "Continue";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const auth = client();

    if (auth) {
      initialiseRecovery(auth);
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
