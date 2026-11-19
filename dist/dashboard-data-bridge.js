(function attachTeam1DashboardData(global) {
  "use strict";

  const SNAPSHOT_STATUSES = new Set(["ready", "saved", "offline", "stale", "conflict"]);
  const BLOCKED_STATUSES = new Set(["loading", "offline", "stale", "conflict"]);

  function create(options = {}) {
    const controller = options.controller;
    if (!controller || typeof controller.subscribe !== "function") {
      throw new Error("A data sync controller is required.");
    }

    const onSnapshot = typeof options.onSnapshot === "function" ? options.onSnapshot : function noop() {};
    const onStatus = typeof options.onStatus === "function" ? options.onStatus : function noop() {};
    let state = controller.getState();
    let unsubscribe = null;

    function receive(nextState) {
      state = nextState;
      onStatus(nextState);
      if (SNAPSHOT_STATUSES.has(nextState.status) && Array.isArray(nextState.projects)) {
        onSnapshot(structuredClone(nextState), nextState);
      }
    }

    async function start() {
      if (!unsubscribe) unsubscribe = controller.subscribe(receive);
      return controller.start();
    }

    async function save(projects) {
      if (!canEdit()) throw new Error("Shared data is not ready for editing.");
      return controller.save(projects);
    }

    function canEdit() {
      return Boolean(controller.isReady()) && !BLOCKED_STATUSES.has(state.status);
    }

    function stop() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      controller.stop();
    }

    return {
      start,
      save,
      canEdit,
      stop,
      getState: () => structuredClone(state),
      refresh: () => controller.refresh(),
    };
  }

  global.Team1DashboardData = { create };
})(globalThis);
