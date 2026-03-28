export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

    setState(updater) {
      state = typeof updater === "function" ? updater(state) : updater;
      for (const listener of listeners) {
        listener(state);
      }
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

