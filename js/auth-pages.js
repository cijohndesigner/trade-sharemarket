
/*
 * CJ Cruz Trade Tracker — Authentication
 *
 * Signup: username + password + confirm password
 * Login: username + password
 * Approval: pending / approved / rejected / suspended
 * Password recovery: registered email
 *
 * Supabase Auth handles passwords. Never store plain-text passwords
 * in database tables or expose the Supabase service-role key.
 */

(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const client = () => window.CJ_SUPABASE;

  function msg(text, type = "error") {
    const element = $("[data-auth-message]");
    if (!element) return;

    element.textContent = text;
    element.className = "auth-message show " + type;
    element.setAttribute("role", "status");
  }

  function normalizeUsername(value) {
    const username = String(value || "").trim().toLowerCase();

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
    return username + "@" + window.CJ_AUTH_EMAIL_DOMAIN;
  }

  function getResetRedirectUrl() {
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocal) {
      return "http://localhost:8000/auth-update-password.html";
    }

    return new URL(
      "auth-update-password.html",
      window.location.href
    ).href;
  }

  async function getApprovalStatus(userId) {
    const { data, error } = await client()
      .from("member_access")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    return String(data?.status || "pending").trim().toLowerCase();
  }

  async function savePendingAccess(userId, username) {
    const { error } = await client()
      .from("member_access")
      .upsert(
        {
          user_id: userId,
          username,
          status: "pending",
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );

    if (error) {
      throw new Error(
        "The authentication account exists, but its approval record could not be saved. Check member_access and its RLS policies. Details: " +
          error.message
      );
    }
  }

  async function handleSignup(auth, formData) {
    const username = normalizeUsername(formData.get("username"));
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password.length < 10) {
      throw new Error("Use a password with at least 10 characters.");
    }

    if (password !== confirmPassword) {
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
      throw new Error("Supabase did not return a user. Please try again.");
    }

    if (!data.session) {
      msg(
        "The account may already have been created, but no session was started. Do not register again. Check the existing user in Supabase Authentication → Users."
      );
      return;
    }

    await savePendingAccess(data.user.id, username);
    await auth.auth.signOut();

    msg(
      "Account created successfully. Your status is Pending until the administrator approves it.",
      "success"
    );

    window.setTimeout(() => {
      window.location.href = "auth-login.html";
    }, 1800);
  }

  async function handleForgotPassword(auth, formData) {
    const email = String(formData.get("email") || "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid registered email address.");
    }

    const redirectTo = getResetRedirectUrl();

    const { error } = await auth.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      throw new Error(
        "Could not request the reset email: " + error.message
      );
    }

    msg(
      "Reset email requested. Open the newest email and click its reset link in this browser.",
      "success"
    );
  }

  async function handleLogin(auth, formData) {
    const username = normalizeUsername(formData.get("username"));
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
          "This account is not confirmed. Ask the administrator to review the existing account in Supabase Authentication → Users."
        );
      }

      if (reason.includes("invalid login credentials")) {
        throw new Error(
          "Username or password is incorrect. Check the registered username and password."
        );
      }

      throw new Error(error.message || "Sign-in failed.");
    }

    let status;

    try {
      status = await getApprovalStatus(data.user.id);
    } catch (error) {
      await auth.auth.signOut();

      throw new Error(
        "Could not verify your approval status. Check member_access and its SELECT policy. " +
          (error?.message || "")
      );
    }

    if (status !== "approved") {
      await auth.auth.signOut();

      const statusMessages = {
        pending: "Your account is waiting for administrator approval.",
        rejected: "Your access request was rejected. Contact the administrator if needed.",
        suspended: "Your account is suspended. Contact the administrator."
      };

      throw new Error(
        statusMessages[status] || "This account is not approved for access."
      );
    }

    window.location.href = "dashboard.html";
  }

  /*
   * Recovery links may provide a session in the URL hash.
   * The password update itself is handled by auth-update-password.html.
   */
  async function initialisePasswordRecovery() {
    const auth = client();
    if (!auth) return;

    const page = window.location.pathname.split("/").pop();
    if (page !== "auth-update-password.html") return;

    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const type = hash.get("type");

    if (type === "recovery" && accessToken && refreshToken) {
      const { error } = await auth.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        msg(
          "The recovery link could not be validated. Request a fresh reset email."
        );
        return;
      }

      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );

      msg(
        "Recovery link verified. Enter your new password on this page.",
        "success"
      );
    }
  }

  async function submit(form) {
    const auth = client();

    if (!auth) {
      msg(
        "Supabase is not configured. Check js/supabase-config.js and its publishable key."
      );
      return;
    }

    const page = window.location.pathname.split("/").pop();
    const formData = new FormData(form);
    const button = form.querySelector('button[type="submit"]');

    if (button) {
      button.disabled = true;
      button.dataset.originalText ||= button.textContent;
      button.textContent = "Please wait…";
    }

    try {
      if (page === "auth-signup.html") {
        await handleSignup(auth, formData);
        return;
      }

      if (page === "auth-forgot-password.html") {
        await handleForgotPassword(auth, formData);
        return;
      }

      if (page === "auth-login.html") {
        await handleLogin(auth, formData);
        return;
      }

      msg(
        "This authentication page is not supported by this handler. Check the page filename."
      );
    } catch (error) {
      const message = String(
        error?.message || "Something went wrong. Please try again."
      );

      if (
        /email signups are disabled|signups not allowed|email provider.*disabled/i.test(
          message
        )
      ) {
        msg(
          "Enable the Email provider in Supabase → Authentication → Sign In / Providers."
        );
      } else {
        msg(message);
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || "Continue";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = $("[data-auth-form]");

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        submit(form);
      });
    }

    initialisePasswordRecovery().catch((error) => {
      console.error("Password recovery initialisation failed:", error);
      msg("Could not initialise password recovery. Request a fresh reset email.");
    });
  });
})();
