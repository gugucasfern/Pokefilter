const STORE_NAME = "resources";

function supportsIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(namespace, version) {
  if (!supportsIndexedDb()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(`${namespace}-${version}`, 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
}

export function createIndexedDbStore({ namespace, version }) {
  let databasePromise;

  function getDatabase() {
    if (!databasePromise) {
      databasePromise = openDatabase(namespace, version).catch(() => null);
    }

    return databasePromise;
  }

  async function runTransaction(mode, callback) {
    const database = await getDatabase();

    if (!database) {
      return undefined;
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = callback(store);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  return {
    async get(key) {
      return runTransaction("readonly", (store) => store.get(key));
    },

    async set(key, value) {
      return runTransaction("readwrite", (store) => store.put(value, key));
    },

    async clear() {
      return runTransaction("readwrite", (store) => store.clear());
    },
  };
}

