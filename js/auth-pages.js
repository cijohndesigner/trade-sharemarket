
/*
 * CJ Cruz Trade Tracker — Authentication
 * Login: email or username
 * Signup: username + password + confirmation
 * Approval: pending / approved / rejected / suspended
 * Recovery: Supabase email recovery + password update
 *
 * Requires:
 *   window.CJ_SUPABASE
 *   window.CJ_AUTH_EMAIL_DOMAIN
 *
 * Never put a Supabase service-role key in browser code.
 */

(function () {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const client = () => window.CJ_SUPABASE;

  const LOGIN_PAGE = "auth-login.html";
  const UPDATE_PAGE = "auth-update-password.html";
  const SIGNUP_PAGE = "auth-signup.html";
  const DASHBOARD_PAGE = "dashboard.html";

  function pageName() {
    return location.pathname.split("/").pop().toLowerCase();
  }

  function showMessage(text, type = "error") {
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

  function normalizeUsername(value) {
    const username = String(value || "").trim().toLowerCase();

    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      throw new Error(
        "Username must be 3–32 characters using letters, numbers, dots, underscores or hyphens."
      );
    }

    return username;
  }

  function usernameEmail(username) {
    const domain = String(
      window.CJ_AUTH_EMAIL_DOMAIN || ""
    ).trim().toLowerCase();

    if (!domain) {
      throw new Error(
        "Authentication configuration is missing CJ_AUTH_EMAIL_DOMAIN."
      );
    }

    return username + "@" + domain;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function detectForm(form) {
    const page = pageName();
    const has = name => !!$('[name="' + name + '"]', form);

    if (page === UPDATE_PAGE) return "update";
    if (page === SIGNUP_PAGE) return "signup";
    if (page === "auth-forgot-password.html") return "forgot";
    if (page === LOGIN_PAGE) return "login";

    if (has("confirmPassword") && has("username")) return "signup";
    if (has("confirmPassword") && has("password")) return "update";
    if (has("email") && !has("password")) return "forgot";
    if (has("username") && has("password")) return "login";

    return "unknown";
  }

  async function approvalStatus(userId) {
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

  function approvalMessage(status) {
    const messages = {
      pending: "Your account is waiting for administrator approval.",
      rejected: "Your access request was rejected.",
      suspended: "Your account is suspended."
    };

    return messages[status] ||
      "Your account is not approved for access.";
  }

  async function handleSignup(auth, formData) {
    const username = normalizeUsername(formData.get("username"));
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirmPassword") || "");

    if (password.length < 10) {
      throw new Error("Use a password with at least 10 characters.");
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

    if (error) {
      if (/already registered|already been registered|user already exists/i.test(error.message || "")) {
        throw new Error(
          "This username may already exist. Ask the administrator to check the existing account."
        );
      }

      throw error;
    }

    if (!data?.user) {
      throw new Error("Supabase did not return a user.");
    }

    if (!data.session) {
      showMessage(
        "The account may have been created, but email confirmation or provider settings prevented a session. Ask the administrator to check Supabase before registering again."
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
        "The account was created, but its approval record could not be saved. Ask the administrator to check member_access policies. " +
        accessError.message
      );
    }

    await auth.auth.signOut();

    showMessage(
      "Account created successfully. Please wait for administrator approval.",
      "success"
    );

    setTimeout(() => {
      window.location.assign(
        new URL(LOGIN_PAGE, location.href).href
      );
    }, 1600);
  }

  async function handleLogin(auth, formData) {
    const enteredValue = String(
      formData.get("username") ||
      formData.get("email") ||
      ""
    ).trim();

    const password = String(formData.get("password") || "");

    if (!enteredValue) {
      throw new Error("Enter your username or Gmail address.");
    }

    if (!password) {
      throw new Error("Enter your password.");
    }

    /*
     * If the member enters a real email address, use it directly.
     * Otherwise use the configured synthetic email.
     *
     * IMPORTANT:
     * Username-only login for an account registered with a different
     * real email requires a secure username-to-email lookup backend.
     */
    let email;

    if (enteredValue.includes("@")) {
      email = enteredValue.toLowerCase();

      if (!validEmail(email)) {
        throw new Error("Enter a valid email address.");
      }
    } else {
      email = usernameEmail(normalizeUsername(enteredValue));
    }

    const { data, error } = await auth.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      const reason = String(error.message || "").toLowerCase();

      if (reason.includes("email not confirmed")) {
        throw new Error(
          "This account's email is not confirmed. Ask the administrator to check the account."
        );
      }

      if (reason.includes("invalid login credentials")) {
        throw new Error(
          "Login failed. For the existing Gmail account, enter the registered Gmail address and its current password."
        );
      }

      throw error;
    }

    let status;

    try {
      status = await approvalStatus(data.user.id);
    } catch (err) {
      await auth.auth.signOut();

      throw new Error(
        "Login succeeded, but approval could not be verified. Ask the administrator to check member_access SELECT permissions."
      );
    }

    if (status !== "approved") {
      await auth.auth.signOut();
      throw new Error(approvalMessage(status));
    }

    window.location.assign(
      new URL(DASHBOARD_PAGE, location.href).href
    );
  }

  async function handleForgot(auth, formData) {
    const email = String(
      formData.get("email") || ""
    ).trim().toLowerCase();

    if (!validEmail(email)) {
      throw new Error("Enter your registered Gmail address.");
    }

    const redirectTo = new URL(
      UPDATE_PAGE,
      location.href
    ).href;

    const { error } = await auth.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) throw error;

    showMessage(
      "If this address is registered, a password-reset email will arrive. Open the newest link to continue.",
      "success"
    );
  }

  async function initialiseRecovery(auth) {
    if (pageName() !== UPDATE_PAGE) return;

    try {
      const url = new URL(location.href);
      const hashParams = new URLSearchParams(
        url.hash.replace(/^#/, "")
      );

      const code = url.searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      if (
        url.searchParams.has("error") ||
        hashParams.has("error") ||
        hashParams.has("error_description")
      ) {
        throw new Error(
          "This reset link is invalid or expired. Request a new email."
        );
      }

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

        showMessage(
          "Reset link verified. Enter your new password.",
          "success"
        );
        return;
      }

      if (accessToken && refreshToken) {
        if (type && type !== "recovery") {
          throw new Error(
            "This link is not a password-recovery link."
          );
        }

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

        showMessage(
          "Reset link verified. Enter your new password.",
          "success"
        );
        return;
      }

      const { data, error } = await auth.auth.getSession();

      if (error) throw error;

      if (data?.session) {
        showMessage(
          "Recovery session found. Enter your new password.",
          "success"
        );
      } else {
        showMessage(
          "No valid reset session was found. Request a fresh reset email and open its newest link."
        );
      }
    } catch (error) {
      console.error("Password recovery initialisation failed:", error);
      showMessage(error.message || "Could not verify the reset link.");
    }
  }

  async function handleUpdate(auth, formData) {
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirmPassword") || "");

    if (password.length < 10) {
      throw new Error("Use a password with at least 10 characters.");
    }

    if (password !== confirm) {
      throw new Error("The passwords do not match.");
    }

    const { data, error: sessionError } =
      await auth.auth.getSession();

    if (sessionError) throw sessionError;

    if (!data?.session) {
      throw new Error(
        "Your reset session is missing or expired. Request a fresh reset email and open its newest link."
      );
    }

    const { error } = await auth.auth.updateUser({ password });

    if (error) throw error;

    showMessage(
      "Password updated successfully. Returning to sign in…",
      "success"
    );

    setTimeout(() => {
      window.location.replace(
        new URL(LOGIN_PAGE, location.href).href
      );
    }, 1400);
  }

  async function submitForm(form) {
    const auth = client();

    if (!auth) {
      showMessage(
        "Supabase is not configured. Check js/supabase-config.js."
      );
      return;
    }

    const type = detectForm(form);
    const formData = new FormData(form);
    const button = $('button[type="submit"]', form);
    const originalText = button?.textContent || "Continue";

    if (button) {
      button.disabled = true;
      button.textContent = "Please wait…";
    }

    try {
      if (type === "signup") {
        await handleSignup(auth, formData);
      } else if (type === "login") {
        await handleLogin(auth, formData);
      } else if (type === "forgot") {
        await handleForgot(auth, formData);
      } else if (type === "update") {
        await handleUpdate(auth, formData);
      } else {
        throw new Error(
          "Could not identify this form. Check the page filename and input names."
        );
      }
    } catch (error) {
      console.error("Authentication error:", error);
      showMessage(error.message || "Something went wrong.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const auth = client();

    if (auth) {
      initialiseRecovery(auth);
    }

    document.querySelectorAll("[data-auth-form]").forEach(form => {
      if (form.dataset.authHandlerAttached === "true") return;

      form.dataset.authHandlerAttached = "true";

      form.addEventListener("submit", event => {
        event.preventDefault();
        submitForm(form);
      });
    });
  });
})();
