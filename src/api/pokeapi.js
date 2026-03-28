function buildUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    const error = new Error(`PokeAPI request failed with status ${response.status}.`);
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return response.json();
}

export function createPokeApiClient({ baseUrl, cache }) {
  const inflightRequests = new Map();

  async function request(path, { signal, useCache = true } = {}) {
    const cacheKey = `resource:${path}`;

    if (useCache) {
      const cachedValue = await cache.get(cacheKey);
      if (cachedValue !== undefined) {
        return cachedValue;
      }
    }

    const canShareInflightRequest = !signal;

    if (canShareInflightRequest && inflightRequests.has(cacheKey)) {
      return inflightRequests.get(cacheKey);
    }

    const requestPromise = fetchJson(buildUrl(baseUrl, path), signal)
      .then(async (payload) => {
        if (useCache) {
          await cache.set(cacheKey, payload);
        }

        return payload;
      });

    if (canShareInflightRequest) {
      const sharedPromise = requestPromise.finally(() => {
        inflightRequests.delete(cacheKey);
      });

      inflightRequests.set(cacheKey, sharedPromise);
      return sharedPromise;
    }

    return requestPromise;
  }

  return {
    request,
    getPokemon(name, options) {
      return request(`/pokemon/${name}/`, options);
    },
    getPokemonSpecies(name, options) {
      return request(`/pokemon-species/${name}/`, options);
    },
    getAbility(name, options) {
      return request(`/ability/${name}/`, options);
    },
    getMove(name, options) {
      return request(`/move/${name}/`, options);
    },
    getEggGroup(name, options) {
      return request(`/egg-group/${name}/`, options);
    },
    getType(name, options) {
      return request(`/type/${name}/`, options);
    },
    listPokemon(limit = 2000, options) {
      return request(`/pokemon/?limit=${limit}`, options);
    },
    listAbilities(limit = 1000, options) {
      return request(`/ability/?limit=${limit}`, options);
    },
    listMoves(limit = 2000, options) {
      return request(`/move/?limit=${limit}`, options);
    },
    listEggGroups(limit = 100, options) {
      return request(`/egg-group/?limit=${limit}`, options);
    },
  };
}
