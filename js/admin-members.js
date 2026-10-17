
/* CJ Cruz Trade Tracker — Admin Member Management
   Members use username + password.
   Password reset and full account deletion require secure Edge Functions.
*/
(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const client = () => window.CJ_SUPABASE;

  const statusOptions = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["suspended", "Suspended"]
];

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);

  function message(text, type = "info") {
    const el = $("#message");
    if (!el) return;
    el.textContent = text;
    el.className = "admin-message show " + type;
  }

  function setLoading(text) {
    const el = $("#loading");
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
  }

  async function verifyAdmin(supabase) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData.session) {
      location.replace("auth-login.html");
      return false;
    }

    // Uses the database-side admin check, not a client-side email check.
    const { data, error } = await supabase.rpc("is_app_admin");

    if (error) {
      throw new Error(
        "Could not verify administrator access. Check that is_app_admin is exposed through the Supabase Data API and executable by authenticated users. " +
        error.message
      );
    }

    if (data !== true) {
      setLoading("Administrator access denied. Sign in with your authorized admin account.");
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
        functionName + " failed. Make sure the secure Supabase Edge Function is deployed. " +
        (error.message || "")
      );
    }

    if (data && data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  async function load() {
    const supabase = client();

    $("#tableWrap").hidden = true;
    $("#membersBody").innerHTML = "";
    setLoading("Checking administrator access…");

    if (!supabase) {
      setLoading("Supabase is not configured. Check js/supabase-config.js.");
      return;
    }

    try {
      const isAdmin = await verifyAdmin(supabase);
      if (!isAdmin) return;

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

      if (profileError) throw profileError;
      if (accessError) throw accessError;

      const profileById = new Map(
        (profiles || []).map((profile) => [profile.user_id, profile])
      );

      const members = (accessRows || []).map((row) => ({
        ...row,
        profile: profileById.get(row.user_id) || {}
      }));

      members.sort((a, b) => {
        const nameA = a.profile.full_name || a.profile.username || a.username || "";
        const nameB = b.profile.full_name || b.profile.username || b.username || "";
        return nameA.localeCompare(nameB);
      });

      if (!members.length) {
        setLoading("No member access records found.");
        message("No members to display.", "info");
        return;
      }

      $("#membersBody").innerHTML = members.map((member) => {
       const currentStatus = String(member.status || "pending")
  .toLowerCase();

        const options = statusOptions.map(([value, label]) =>
          `<option value="${value}" ${value === currentStatus ? "selected" : ""}>${label}</option>`
        ).join("");

        const username = member.profile.username || member.username || "";
        const displayName = member.profile.full_name || username || "Member";

        return `
          <tr data-user-id="${escapeHtml(member.user_id)}">
            <td>
              <strong>${escapeHtml(displayName)}</strong>
              <div class="muted">${escapeHtml(username)}</div>
            </td>
            <td>${escapeHtml(member.profile.phone || "Not provided")}</td>
            <td>
              <select class="status-select" aria-label="Status for ${escapeHtml(displayName)}">
                ${options}
              </select>
            </td>
            <td>
              <div class="admin-actions">
                <button class="save-row admin-btn primary" type="button">Save</button>
                <button class="reset-row admin-btn" type="button">Reset Password</button>
                <button class="delete-row admin-btn" type="button">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join("");

      $("#loading").hidden = true;
      $("#tableWrap").hidden = false;

      wireActions(supabase);
      message("Loaded " + members.length + " member record(s).", "success");
    } catch (error) {
      setLoading("Could not load the member list.");
      message(error.message || "Unexpected error while loading members.", "error");
    }
  }

  function wireActions(supabase) {
    $("#membersBody").querySelectorAll(".save-row").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest("tr");
        const userId = row.dataset.userId;
        const status = row.querySelector(".status-select").value;

        button.disabled = true;
        button.textContent = "Saving…";

        try {
          // Re-check admin status immediately before the write.
          if (!(await verifyAdmin(supabase))) return;

          const { error } = await supabase
            .from("member_access")
            .update({
              status,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", userId);

          if (error) throw error;

          message("Member status saved: " + status + ".", "success");
        } catch (error) {
          message("Could not save status. " + error.message, "error");
        } finally {
          button.disabled = false;
          button.textContent = "Save";
        }
      });
    });

    $("#membersBody").querySelectorAll(".reset-row").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest("tr");
        const userId = row.dataset.userId;

        const newPassword = prompt(
          "Enter the new password (minimum 10 characters)."
        );

        if (newPassword === null) return;

        if (newPassword.length < 10) {
          message("Password must contain at least 10 characters.", "error");
          return;
        }

        const confirmPassword = prompt("Enter the new password again to confirm.");

        if (confirmPassword === null) return;

        if (newPassword !== confirmPassword) {
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
            { user_id: userId, new_password: newPassword }
          );

          message("Password reset successfully.", "success");
        } catch (error) {
          message(error.message, "error");
        } finally {
          button.disabled = false;
          button.textContent = "Reset Password";
        }
      });
    });

    $("#membersBody").querySelectorAll(".delete-row").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest("tr");
        const userId = row.dataset.userId;

        if (!confirm(
          "Permanently delete this member and their account? This may remove their saved trading data. This action cannot be undone."
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
        } catch (error) {
          message(error.message, "error");
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
      if (client()) await client().auth.signOut();
      location.replace("auth-login.html");
    });

    load();
  });
})();
