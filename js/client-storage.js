
/*
 * CJ Cruz Trade Tracker — Client Storage
 * Isolates browser storage by authenticated Supabase user ID.
 *
 * IMPORTANT:
 * This module does not automatically change existing app storage calls.
 * Existing pages must use CJClientStorage to read/write isolated data.
 * This is browser-side separation, not server-side security.
 */

(function () {
  "use strict";

  const PREFIX = "cjcruz:client:";
  const LEGACY_KEYS = [
    "trades",
    "depositsWithdrawals",
    "snapshots",
    "srbSnapshots",
    "gapHistory",
    "mainBalance",
    "availableBalance",
    "manualAdjustment"
  ];

  let activeUserId = null;

  function getSupabase() {
    return window.CJ_SUPABASE || null;
  }

  async function getUser() {
    const supabase = getSupabase();

    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;
    if (!data?.user) {
      throw new Error("Please sign in before accessing trading data.");
    }

    return data.user;
  }

  function keyFor(userId, key) {
    if (!userId) {
      throw new Error("No authenticated client is active.");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(String(key))) {
      throw new Error("Invalid storage key.");
    }

    return PREFIX + userId + ":" + key;
  }

  function assertActive(userId) {
    if (!activeUserId || activeUserId !== userId) {
      throw new Error(
        "Client storage is not initialized for this account."
      );
    }
  }

  async function initialize() {
    const user = await getUser();
    activeUserId = user.id;

    return {
      userId: user.id,
      email: user.email || null
    };
  }

  function get(key, fallback = null) {
    assertActive(activeUserId);

    const raw = localStorage.getItem(keyFor(activeUserId, key));

    if (raw === null) return fallback;

    try {
      return JSON.parse(raw);
    } catch {
      console.error("Invalid client storage data for key:", key);
      return fallback;
    }
  }

  function set(key, value) {
    assertActive(activeUserId);

    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new Error("This value cannot be saved as JSON.");
    }

    localStorage.setItem(
      keyFor(activeUserId, key),
      serialized
    );
  }

  function remove(key) {
    assertActive(activeUserId);
    localStorage.removeItem(keyFor(activeUserId, key));
  }

  function clearCurrentClientData() {
    assertActive(activeUserId);

    const prefix = PREFIX + activeUserId + ":";
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  function listCurrentClientKeys() {
    assertActive(activeUserId);

    const prefix = PREFIX + activeUserId + ":";
    const keys = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key && key.startsWith(prefix)) {
        keys.push(key.slice(prefix.length));
      }
    }

    return keys;
  }

  function getLegacyDataInventory() {
    // Read-only inventory. Does not import, change, or delete legacy data.
    return LEGACY_KEYS.map(key => ({
      key,
      exists: localStorage.getItem(key) !== null
    }));
  }

  function lock() {
    // Call on logout or account change.
    activeUserId = null;
  }

  window.CJClientStorage = Object.freeze({
    initialize,
    get,
    set,
    remove,
    clearCurrentClientData,
    listCurrentClientKeys,
    getLegacyDataInventory,
    lock
  });

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await initialize();
      document.dispatchEvent(
        new CustomEvent("cj:client-storage-ready")
      );
    } catch (error) {
      lock();
      console.info(
        "Client storage not initialized:",
        error.message
      );
    }
  });

  window.addEventListener("storage", event => {
    if (event.key === null) {
      lock();
    }
  });
})();

