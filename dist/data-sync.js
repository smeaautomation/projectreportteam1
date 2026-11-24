(function attachTeam1DataSync(root) {
  "use strict";

  const DEFAULT_CACHE_KEY = "team1-shared-cache-v1";
  const DEFAULT_ENDPOINT = "/api/data";

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function publicSnapshot(payload) {
    return {
      projects: clone(payload.projects || []),
      weeklyPolicyCounts: clone(payload.weeklyPolicyCounts || {}),
      weeklyObstacles: clone(payload.weeklyObstacles || {}),
      revision: Number(payload.revision || 0),
      updatedAt: payload.updatedAt || "",
      updatedBy: payload.updatedBy || "",
      realtime: payload.realtime ? clone(payload.realtime) : null,
    };
  }

  function create(options = {}) {
    const fetchImpl = options.fetchImpl || root.fetch?.bind(root);
    const storage = options.storage || root.localStorage;
    const deployed = options.deployed || { projects: [], updatedAt: "" };
    const endpoint = options.endpoint || DEFAULT_ENDPOINT;
    const cacheKey = options.cacheKey || DEFAULT_CACHE_KEY;
    const realtimeFactory = options.realtimeFactory;
    const listeners = new Set();
    let confirmed = null;
    let realtimeSubscription = null;
    let refreshPromise = null;
    let drainPromise = null;
    let pendingSnapshot = null;
    let ready = false;
    let stopped = false;
    let state = {
      status: "loading",
      projects: clone(deployed.projects || []),
      weeklyPolicyCounts: {},
      weeklyObstacles: {},
      revision: 0,
      updatedAt: deployed.updatedAt || "",
      updatedBy: "",
      error: "",
    };

    if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");

    function getState() {
      return clone(state);
    }

    function notify() {
      const snapshot = getState();
      for (const listener of listeners) listener(snapshot);
    }

    function setState(status, values = {}) {
      state = { ...state, ...values, status };
      notify();
      return getState();
    }

    function cacheConfirmed() {
      if (!storage || !confirmed) return;
      try {
        storage.setItem(cacheKey, JSON.stringify(confirmed));
      } catch {
        // A full or unavailable browser cache must never block server confirmation.
      }
    }

    function adopt(payload, status) {
      confirmed = publicSnapshot(payload);
      cacheConfirmed();
      ready = status === "ready" || status === "saved";
      return setState(status, { ...confirmed, error: "" });
    }

    function cachedSnapshot() {
      if (!storage) return null;
      try {
        const parsed = JSON.parse(storage.getItem(cacheKey));
        return parsed && Array.isArray(parsed.projects) ? publicSnapshot(parsed) : null;
      } catch {
        return null;
      }
    }

    async function responseJson(response) {
      let body = {};
      try {
        body = await response.json();
      } catch {
        body = {};
      }
      return { body, response };
    }

    async function readServer() {
      const { body, response } = await responseJson(await fetchImpl(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
      }));
      if (!response.ok) throw new Error(body.error || `Shared data request failed (${response.status})`);
      return body;
    }

    function setRealtime(payload) {
      if (!realtimeFactory || !payload?.realtime || stopped) return;
      realtimeSubscription?.unsubscribe?.();
      realtimeSubscription = realtimeFactory(
        payload.realtime,
        (change) => refresh(change),
        (subscriptionStatus) => {
          if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(subscriptionStatus)) {
            ready = false;
            setState("stale", { error: "Koneksi pembaruan langsung terputus." });
          }
          if (subscriptionStatus === "SUBSCRIBED" && !ready) return refresh();
        },
      );
    }

    async function start() {
      stopped = false;
      setState("loading", { error: "" });
      try {
        const server = await readServer();
        const next = adopt(server, "ready");
        setRealtime(server);
        return next;
      } catch (error) {
        const fallback = cachedSnapshot() || publicSnapshot({
          projects: deployed.projects || [],
          revision: 0,
          updatedAt: deployed.updatedAt || "",
          updatedBy: "",
        });
        confirmed = fallback;
        ready = false;
        return setState("offline", { ...fallback, error: error?.message || "Data bersama tidak tersedia." });
      }
    }

    async function refresh(change) {
      if (stopped) return getState();
      const announcedRevision = Number(change?.new?.revision || 0);
      if (announcedRevision && confirmed && announcedRevision <= confirmed.revision) return getState();
      if (refreshPromise) return refreshPromise;
      refreshPromise = (async () => {
        try {
          const server = await readServer();
          if (!confirmed || server.revision > confirmed.revision) return adopt(server, "ready");
          ready = true;
          return setState("ready", { error: "" });
        } catch (error) {
          ready = false;
          return setState("stale", { error: error?.message || "Pembaruan langsung gagal dimuat." });
        } finally {
          refreshPromise = null;
        }
      })();
      return refreshPromise;
    }

    async function writeSnapshot(snapshot) {
      const baseRevision = confirmed?.revision || 0;
      setState("saving", { projects: clone(snapshot.projects ?? state.projects), error: "" });
      const { body, response } = await responseJson(await fetchImpl(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...snapshot, baseRevision }),
      }));
      if (response.status === 409) {
        pendingSnapshot = null;
        confirmed = publicSnapshot(body);
        cacheConfirmed();
        ready = false;
        return setState("conflict", { ...confirmed, error: "Data terbaru dari editor lain telah dimuat." });
      }
      if (!response.ok) throw new Error(body.error || `Shared data write failed (${response.status})`);
      return adopt(body, "saved");
    }

    async function drainWrites() {
      try {
        let result = getState();
        while (pendingSnapshot) {
          const next = pendingSnapshot;
          pendingSnapshot = null;
          result = await writeSnapshot(next);
          if (result.status === "conflict") break;
        }
        return result;
      } catch (error) {
        pendingSnapshot = null;
        ready = false;
        const rollback = confirmed || publicSnapshot({ projects: deployed.projects || [], updatedAt: deployed.updatedAt || "" });
        setState("offline", { ...rollback, error: error?.message || "Perubahan gagal disimpan." });
        throw error;
      }
    }

    function save(projects, { weeklyPolicyCounts, weeklyObstacles } = {}) {
      if (!ready || !confirmed) return Promise.reject(new Error("Shared data is not ready for editing"));
      pendingSnapshot = { ...pendingSnapshot, ...clone({ projects, weeklyPolicyCounts, weeklyObstacles }) };
      if (!drainPromise) {
        drainPromise = drainWrites().finally(() => {
          drainPromise = null;
        });
      }
      return drainPromise;
    }

    function subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Listener must be a function");
      listeners.add(listener);
      listener(getState());
      return () => listeners.delete(listener);
    }

    function isReady() {
      return ready;
    }

    function stop() {
      stopped = true;
      ready = false;
      realtimeSubscription?.unsubscribe?.();
      realtimeSubscription = null;
      listeners.clear();
    }

    return { start, save, subscribe, isReady, stop, getState, refresh };
  }

  root.Team1DataSync = { create };
})(globalThis);
