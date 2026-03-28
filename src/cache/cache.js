import { createIndexedDbStore } from "./indexeddb.js";

export function createCache({ namespace, version }) {
  const memoryStore = new Map();
  const persistentStore = createIndexedDbStore({ namespace, version });

  return {
    async get(key) {
      if (memoryStore.has(key)) {
        return memoryStore.get(key);
      }

      const persistedValue = await persistentStore.get(key);

      if (persistedValue !== undefined) {
        memoryStore.set(key, persistedValue);
      }

      return persistedValue;
    },

    async set(key, value) {
      memoryStore.set(key, value);
      await persistentStore.set(key, value);
      return value;
    },

    async clear() {
      memoryStore.clear();
      await persistentStore.clear();
    },
  };
}

