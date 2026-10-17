
/* CJ Cruz Trade Tracker — Admin Member Management
 * Statuses: pending / approved / rejected / suspended
 * Requires: is_app_admin() RPC and secure Supabase Edge Functions
 */
(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const client = () => window.CJ_SUPABASE;

  const STATUS_OPTIONS = [
    ["pending", "Pending"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["suspended", "Suspended"]
  ];

  const VALID_STATUSES = new Set(STATUS_OPTIONS.map(([value]) => value));

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function message(text, type = "info") {
    const el = $("#message");
    if (!el) return;
    el.textContent = String(text || "");
    el.className = "admin-message show " + type;
    el.setAttribute("role", "status");
  }

  function setLoading(text) {
    const el = $("#loading");
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
  }

  function normalizeStatus(value) {
    const status = String(value || "pending").trim().toLowerCase();

    // Convert old status values to the current vocabulary.
    if (status === "blocked") return "suspended";

    return VALID_STATUSES.has(status) ? status : "pending";
  }

  function readableError(error) {
    const text = String(error?.message || error || "Unknown error");

    if (/row.level security|violates row-level security/i.test(text)) {
      return text +
        " Check the member_access RLS UPDATE policy for authorized admins.";
    }

    if (/is_app_admin|function .* does not exist|could not find the function/i.test(text)) {
      return text +
        " Check that the is_app_admin() database function exists and is executable.";
    }

    return text;
  }

  async function verifyAdmin(supabase) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData?.session) {
      location.replace("auth-login.html");
      return false;
    }

    const { data, error } = await supabase.rpc("is_app_admin");

    if (error) {
      throw new Error(
        "Administrator verification failed: " + error.message
      );
    }

    if (data !== true) {
      setLoading("Administrator access denied.");
      message(
        "Sign in with an authorized administrator account.",
        "error"
      );
      return false;
    }

    return true;
  }

  async function invokeAdminFunction(supabase, functionName, body) {
    const { data, error } = await supabase.functions.invoke(
      functionName,
      { body }
    );

    if (error) {
      throw new Error(
        functionName +
        " failed. Confirm that the secure Supabase Edge Function is deployed. " +
        error.message
      );
    }

    if (data?.error) throw new Error(String(data.error));

    return data;
  }

  async function load() {
    const supabase = client();
    const tableWrap = $("#tableWrap");
    const membersBody = $("#membersBody");

    if (tableWrap) tableWrap.hidden = true;
    if (membersBody) membersBody.innerHTML = "";

    setLoading("Checking administrator access…");

    if (!supabase) {
      setLoading("Supabase is not configured. Check js/supabase-config.js.");
      message("Supabase configuration is missing.", "error");
      return;
    }

    try {
      if (!(await verifyAdmin(supabase))) return;

      setLoading("Loading members…");

      const [
        { data: profiles, error: profileError },
        { data: accessRows, error: accessError }
      ] = await Promise.all([
        supabase
          .from("member_profiles")
          .select("user_id, username, full_name, phone, created_at"),

        supabase
          .from("member_access")
          .select("user_id, username, status, created_at, updated_at")
      ]);

      if (profileError) {
        throw new Error(
          "Could not load member_profiles: " + profileError.message
        );
      }

      if (accessError) {
        throw new Error(
          "Could not load member_access: " + accessError.message
        );
      }

      const profileById = new Map(
        (profiles || []).map((profile) => [profile.user_id, profile])
      );

      const members = (accessRows || []).map((row) => ({
        ...row,
        status: normalizeStatus(row.status),
        profile: profileById.get(row.user_id) || {}
      }));

      members.sort((a, b) => {
        const nameA =
          a.profile.full_name ||
          a.profile.username ||
          a.username ||
          "";

        const nameB =
          b.profile.full_name ||
          b.profile.username ||
          b.username ||
          "";

        return nameA.localeCompare(nameB);
      });

      if (!members.length) {
        setLoading("No member access records found.");
        message(
          "No member access records found. Each account needs a matching member_access record before it appears here.",
          "info"
        );
        return;
      }

      membersBody.innerHTML = members.map((member) => {
        const currentStatus = normalizeStatus(member.status);

        const options = STATUS_OPTIONS.map(([value, label]) =>
          `<option value="${value}" ${
            value === currentStatus ? "selected" : ""
          }>${label}</option>`
        ).join("");

        const username =
          member.profile.username ||
          member.username ||
          "";

        const displayName =
          member.profile.full_name ||
          username ||
          "Member";

        const phone = member.profile.phone || "Not provided";

        return `
          <tr data-user-id="${escapeHtml(member.user_id)}">
            <td>
              <strong>${escapeHtml(displayName)}</strong>
              <div class="muted">
                ${escapeHtml(username || "Username not recorded")}
              </div>
            </td>

            <td>${escapeHtml(phone)}</td>

            <td>
              <select
                class="status-select"
                aria-label="Status for ${escapeHtml(displayName)}"
              >
                ${options}
              </select>
            </td>

            <td>
              <div class="admin-actions">
                <button class="save-row admin-btn primary" type="button">
                  Save
                </button>

                <button class="reset-row admin-btn" type="button">
                  Reset Password
                </button>

                <button class="delete-row admin-btn" type="button">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");

      $("#loading").hidden = true;
      tableWrap.hidden = false;

      wireActions(supabase);

      message(
        "Loaded " + members.length + " member record(s).",
        "success"
      );
    } catch (error) {
      setLoading("Could not load the member list.");
      message(readableError(error), "error");
    }
  }

  function wireActions(supabase) {
    // SAVE APPROVAL STATUS
    $("#membersBody").querySelectorAll(".save-row").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest("tr");
        const userId = row?.dataset.userId;
        const select = row?.querySelector(".status-select");
        const status = normalizeStatus(select?.value);

        if (!userId || !select) {
          message("Could not identify this member. Refresh and try again.", "error");
          return;
        }

        if (!VALID_STATUSES.has(status)) {
          message("Choose a valid approval status.", "error");
          return;
        }

        button.disabled = true;
        button.textContent = "Saving…";

        try {
          if (!(await verifyAdmin(supabase))) return;

          const { data, error } = await supabase
            .from("member_access")
            .update({
              status,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", userId)
            .select("user_id, status")
            .maybeSingle();

          if (error) throw error;

          if (!data) {
            throw new Error(
              "No record was updated. Check the member_access UPDATE policy and confirm this user_id exists."
            );
          }

          select.value = normalizeStatus(data.status);

          message(
            "Member status saved as " + data.status + ".",
            "success"
          );
        } catch (error) {
          message(
            "Could not save status: " + readableError(error),
            "error"
          );
        } finally {
          button.disabled = false;
          button.textContent = "Save";
        }
      });
    });

    // RESET PASSWORD — REQUIRES A SECURE EDGE FUNCTION
    $("#membersBody").querySelectorAll(".reset-row").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest("tr");
        const userId = row?.dataset.userId;

        if (!userId) {
          message("Could not identify this member.", "error");
          return;
        }

        const newPassword = prompt(
          "Enter the new password (minimum 10 characters)."
        );

        if (newPassword === null) return;

        if (newPassword.length < 10) {
          message("Password must contain at least 10 characters.", "error");
          return;
        }

        const confirmation = prompt(
          "Enter the new password again to confirm."
        );

        if (confirmation === null) return;

        if (newPassword !== confirmation) {
          message("Passwords do not match.", "error");
          return;
        }

        if (!confirm("Reset this member's password?")) return;

        button.disabled = true;
        button.textContent = "Resetting…";

        try {
          if (!(await verifyAdmin(supabase))) return;

          await invokeAdminFunction(
            supabase,
            "admin-reset-password",
            {
              user_id: userId,
              new_password: newPassword
            }
          );

          message("Password reset successfully.", "success");
        } catch (error) {
          message(readableError(error), "error");
        } finally {
          button.disabled = false;
          button.textContent = "Reset Password";
        }
      });
    });

    // DELETE MEMBER — REQUIRES A SECURE EDGE FUNCTION
    $("#membersBody").querySelectorAll(".delete-row").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest("tr");
        const userId = row?.dataset.userId;

        if (!userId) {
          message("Could not identify this member.", "error");
          return;
        }

        if (!confirm(
          "Permanently delete this member and their account? Their trading data may also be removed. This cannot be undone."
        )) return;

        if (!confirm(
          "Final confirmation: delete this member permanently?"
        )) return;

        button.disabled = true;
        button.textContent = "Deleting…";

        try {
          if (!(await verifyAdmin(supabase))) return;

          await invokeAdminFunction(
            supabase,
            "admin-delete-member",
            { user_id: userId }
          );

          row.remove();
          message("Member deleted successfully.", "success");

          if (!$("#membersBody").querySelector("tr")) {
            $("#tableWrap").hidden = true;
            setLoading("No member access records found.");
          }
        } catch (error) {
          message(readableError(error), "error");
        } finally {
          button.disabled = false;
          button.textContent = "Delete";
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#refreshBtn")?.addEventListener("click", load);

    $("#signOutBtn")?.addEventListener("click", async () => {
      try {
        if (client()) await client().auth.signOut();
      } finally {
        location.replace("auth-login.html");
      }
    });

    load();
  });
})();
