
/*
 * CJ Cruz Trade Tracker — Authentication
 *
 * Signup: username + password + confirm password
 * Login: username + password
 * Approval: pending / approved / rejected / suspended
 * Recovery: username-based administrator reset, or email reset
 *           when the forgot-password form explicitly has an email field.
 *
 * Supabase Auth internally maps usernames to synthetic email addresses.
 * Never store plaintext passwords or expose the service-role key.
 */

(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const client = () => window.CJ_SUPABASE;

  function msg(text, type = "error") {
    const el = $("[data-auth-message]");
    if (!el) {
      console[type === "error" ? "error" : "log"](text);
      return;
    }

    el.textContent = text;
    el.className = "auth-message show " + type;
    el.setAttribute("role", "status");
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
    return username + "@" +
      String(window.CJ_AUTH_EMAIL_DOMAIN).trim().toLowerCase();
  }

  /*
   * Detect the page using both its URL and the actual form fields.
   * This supports a login page served at the website root.
   */
  function detectPage(form) {
    const path = window.location.pathname
      .replace(/\/+$/, "")
      .split("/")
      .pop()
      .toLowerCase();

    const has = (name) =>
      !!$('[name="' + name + '"]', form);

    if (path === "auth-signup.html" ||
        (has("username") && has("confirmPassword") && has("password"))) {
      return "signup";
    }

    if (path === "auth-update-password.html") {
      return "update-password";
    }

    if (path === "auth-forgot-password.html") {
      return "forgot-password";
    }

    if (path === "auth-login.html") {
      return "login";
    }

    /*
     * The supplied forgot-password HTML uses an email field.
     * The username recovery form uses a username field instead.
     */
    if (has("email") && !has("password")) {
      return "forgot-password";
    }

    if (has("username") && has("password")) {
      return "login";
    }

    if (has("password") && has("confirmPassword")) {
      return "update-password";
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

  async function savePendingAccess(userId, username) {
    const { error } = await client()
      .from("member_access")
      .insert({
        user_id: userId,
        username: username,
        status: "pending",
        updated_at: new Date().toISOString()
      });

    if (error) {
      if (error.code === "23505" ||
          /duplicate key|already exists/i.test(error.message || "")) {
        throw new Error(
          "An account or username record already exists. Ask the administrator to check member_access. Do not register again."
        );
      }

      throw new Error(
        "The authentication account was created, but its pending approval record could not be saved. Check the member_access INSERT policy. Details: " +
        error.message
      );
    }
  }

  async function handleSignup(auth, formData) {
    const username = normalizeUsername(formData.get("username"));
    const password = String(formData.get("password") || "");
    const confirmPassword =
      String(formData.get("confirmPassword") || "");

    if (password.length < 10) {
      throw new Error("Use a password with at least 10 characters.");
    }

    if (password !== confirmPassword) {
      throw new Error("The passwords do not match.");
    }

    const { data, error } = await auth.auth.signUp({
      email: usernameEmail(username),
      password: password,
      options: {
        data: {
          username: username,
          display_name: username,
          full_name: username
        }
      }
    });

    if (error) {
      const reason = String(error.message || "").toLowerCase();

      if (
        reason.includes("already registered") ||
        reason.includes("already been registered") ||
        reason.includes("user already exists")
      ) {
        throw new Error(
          "This username may already be registered. Ask the administrator to check Supabase Authentication → Users before trying again."
        );
      }

      throw error;
    }

    if (!data?.user) {
      throw new Error("Supabase did not return a user. Please try again.");
    }

    if (!data.session) {
      msg(
        "The account was created, but Supabase did not start a session. The pending approval record may not have been saved. Do not register again. Ask the administrator to check the existing account and email confirmation settings."
      );
      return;
    }

    try {
      await savePendingAccess(data.user.id, username);
    } catch (error) {
      await auth.auth.signOut();
      throw error;
    }

    await auth.auth.signOut();

    msg(
      "Account created successfully. Your status is Pending until the administrator approves it.",
      "success"
    );

    window.setTimeout(() => {
      window.location.href = "auth-login.html";
    }, 1800);
  }

  async function handleLogin(auth, formData) {
    const username = normalizeUsername(formData.get("username"));
    const password = String(formData.get("password") || "");

    if (!password) {
      throw new Error("Enter your password.");
    }

    const { data, error } = await auth.auth.signInWithPassword({
      email: usernameEmail(username),
      password: password
    });

    if (error) {
      const reason = String(error.message || "").toLowerCase();

      if (reason.includes("email not confirmed")) {
        throw new Error(
          "This account is not confirmed in Supabase. Ask the administrator to review the existing account. Do not register again."
        );
      }

      if (reason.includes("invalid login credentials")) {
        throw new Error(
          "Username or password is incorrect. Check the registered username and password. Remember, usernames are matched without regard to letter case."
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
        "Could not verify member approval. Check the member_access table and its SELECT policy. " +
        (error?.message || "")
      );
    }

    if (status !== "approved") {
      await auth.auth.signOut();

      const messages = {
        pending: "Your account is waiting for administrator approval.",
        rejected: "Your access request was rejected. Contact the administrator.",
        suspended: "Your account is suspended. Contact the administrator."
      };

      throw new Error(
        messages[status] ||
        "This account is not approved for access."
      );
    }

    window.location.href = "dashboard.html";
  }

  async function handleForgotPassword(auth, formData) {
    /*
     * Username-only recovery: no reset email can be sent because the
     * synthetic email is hidden from the member.
     */
    const usernameValue = formData.get("username");

    if (usernameValue !== null) {
      const username = normalizeUsername(usernameValue);

      msg(
        "Password reset for username '" + username +
        "' is managed by the CJ Cruz administrator. Contact the administrator to verify your identity and reset your password securely. Never share your current password.",
        "success"
      );
      return;
    }

    /*
     * Optional email-based recovery for the existing HTML form that
     * explicitly asks for a registered email address.
     */
    const email = String(formData.get("email") || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid registered email address.");
    }

    const { error } = await auth.auth.resetPasswordForEmail(email, {
      redirectTo: new URL(
        "auth-update-password.html",
        window.location.href
      ).href
    });

    if (error) {
      throw new Error("Could not request the reset email: " + error.message);
    }

    msg(
      "If this email is registered, a password-reset message will be sent. Open the newest email and follow its instructions.",
      "success"
    );
  }

  async function handleUpdatePassword(auth, formData) {
    const password = String(formData.get("password") || "");
    const confirmPassword =
      String(formData.get("confirmPassword") || "");

    if (password.length < 10) {
      throw new Error("Use a password with at least 10 characters.");
    }

    if (password !== confirmPassword) {
      throw new Error("The passwords do not match.");
    }

    /*
     * Supabase must have an authenticated recovery session here.
     * Never allow a normal visitor to change an arbitrary user's password.
     */
    const { data: sessionData, error: sessionError } =
      await auth.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData?.session) {
      throw new Error(
        "No valid password-reset session was found. Request a fresh reset link or contact the administrator."
      );
    }

    const { error } = await auth.auth.updateUser({
      password: password
    });

    if (error) throw error;

    await auth.auth.signOut();

    msg(
      "Password updated successfully. You can now sign in.",
      "success"
    );

    window.setTimeout(() => {
      window.location.href = "auth-login.html";
    }, 1800);
  }

  async function submit(form) {
    const auth = client();

    if (!auth) {
      msg(
        "Supabase is not configured. Check js/supabase-config.js and its publishable key."
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
      switch (page) {
        case "signup":
          await handleSignup(auth, formData);
          break;

        case "login":
          await handleLogin(auth, formData);
          break;

        case "forgot-password":
          await handleForgotPassword(auth, formData);
          break;

        case "update-password":
          await handleUpdatePassword(auth, formData);
          break;

        default:
          throw new Error(
            "Could not identify this authentication form. Check that it contains data-auth-form and the correct input names."
          );
      }
    } catch (error) {
      const message = String(
        error?.message || "Something went wrong. Please try again."
      );

      if (
        /email signups are disabled|signups not allowed|email provider.*disabled/i.test(message)
      ) {
        msg(
          "Enable the Email provider in Supabase → Authentication → Sign In / Providers. For username-based signup, turn Confirm email OFF."
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
    const forms = document.querySelectorAll("[data-auth-form]");

    forms.forEach(function (form) {
      /*
       * Prevent accidental duplicate listeners if this script is
       * included more than once.
       */
      if (form.dataset.authHandlerAttached === "true") return;

      form.dataset.authHandlerAttached = "true";

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        submit(form);
      });
    });
  });
})();
