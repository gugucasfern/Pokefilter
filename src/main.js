import { createPokeApiClient } from "./api/pokeapi.js";
import { createCache } from "./cache/cache.js";
import { APP_CONFIG, SAMPLE_ABILITIES, SAMPLE_MOVES, TYPE_OPTIONS } from "./config.js";
import {
  createEmptyQuery,
  createStatRule,
  hasActiveFilters,
  hydrateQueryDraft,
} from "./search/query-model.js";
import { runSearch } from "./search/query-engine.js";
import { createStore } from "./state/store.js";
import { renderFilters, bindFilters } from "./ui/filters.js";
import { bindResults, renderResults } from "./ui/results.js";
import { renderStatus } from "./ui/status.js";
import { normalizeApiName } from "./utils/normalize.js";

const filterPanel = document.querySelector("#filter-panel");
const statusPanel = document.querySelector("#status-panel");
const resultsPanel = document.querySelector("#results-panel");

if (!filterPanel || !statusPanel || !resultsPanel) {
  throw new Error("App root elements are missing from index.html.");
}

const cache = createCache({
  namespace: APP_CONFIG.cacheNamespace,
  version: APP_CONFIG.cacheVersion,
});

const api = createPokeApiClient({
  baseUrl: APP_CONFIG.pokeApiBaseUrl,
  cache,
});

const store = createStore(createInitialState());
let activeSearchController = null;

const actions = {
  addToken(group, rawValue) {
    const normalizedValue = normalizeApiName(rawValue);

    if (!normalizedValue) {
      return;
    }

    updateQuery((query) => {
      const values = new Set(query[group]);
      values.add(normalizedValue);

      return {
        ...query,
        [group]: [...values].sort((left, right) => left.localeCompare(right)),
      };
    });

    setStatus({
      tone: "idle",
      title: "Filter added",
      message: "Keep composing the query or click Search to validate the scaffold flow.",
    });
  },

  removeToken(group, value) {
    updateQuery((query) => ({
      ...query,
      [group]: query[group].filter((item) => item !== value),
    }));
  },

  setOperator(group, operator) {
    updateQuery((query) => ({
      ...query,
      operators: {
        ...query.operators,
        [group]: operator,
      },
    }));
  },

  addStatRule() {
    updateQuery((query) => ({
      ...query,
      stats: [...query.stats, createStatRule()],
    }));
  },

  updateStatRule(ruleId, patch) {
    updateQuery((query) => ({
      ...query,
      stats: query.stats.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule
      ),
    }));
  },

  removeStatRule(ruleId) {
    updateQuery((query) => ({
      ...query,
      stats: query.stats.filter((rule) => rule.id !== ruleId),
    }));
  },

  clearFilters() {
    store.setState((state) => ({
      ...state,
      query: createEmptyQuery(),
      results: [],
      lastSearchPreview: "",
      ui: {
        ...state.ui,
        isSearching: false,
        hasSearched: false,
        sort: createDefaultSort(),
      },
      status: {
        tone: "idle",
        title: "Builder reset",
        message: "All draft filters were cleared. Start a new search composition.",
      },
    }));
  },

  async search() {
    const currentQuery = store.getState().query;

    if (!hasActiveFilters(currentQuery)) {
      setStatus({
        tone: "warning",
        title: "Add at least one filter",
        message:
          "DexQuery is designed as a targeted search screen, so the first scaffold does not render a full Pokemon list by default.",
      });
      return;
    }

    store.setState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        isSearching: true,
      },
      status: {
        tone: "loading",
        title: "Assembling search payload",
        message:
          "The query model is being validated. Live PokeAPI execution will plug into this same action next.",
      },
    }));

    if (activeSearchController) {
      activeSearchController.abort();
    }

    const controller = new AbortController();
    activeSearchController = controller;

    try {
      const payload = await runSearch(currentQuery, {
        api,
        signal: controller.signal,
        onProgress: setStatus,
      });

      if (controller.signal.aborted) {
        return;
      }

      store.setState((state) => ({
        ...state,
        results: payload.results,
        lastSearchPreview: payload.preview,
        ui: {
          ...state.ui,
          isSearching: false,
          hasSearched: true,
        },
        status: payload.status,
      }));
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      store.setState((state) => ({
        ...state,
        results: [],
        ui: {
          ...state.ui,
          isSearching: false,
          hasSearched: true,
        },
        status: {
          tone: "warning",
          title: "Search failed",
          message:
            error?.message ||
            "The live search could not be completed. Please try again.",
        },
      }));
    } finally {
      if (activeSearchController === controller) {
        activeSearchController = null;
      }
    }
  },

  toggleSort(column) {
    store.setState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        sort: getNextSort(state.ui.sort, column),
      },
    }));
  },
};

bindFilters(filterPanel, actions);
bindResults(resultsPanel, actions);

store.subscribe((state) => {
  persistDraft(state.query);
  renderApp(state);
});

renderApp(store.getState());
bootstrapReferenceData();

window.dexQuery = {
  api,
  cache,
  store,
  actions,
};

function createInitialState() {
  return {
    query: loadDraft(),
    results: [],
    lastSearchPreview: "",
    status: {
      tone: "idle",
      title: "Builder ready",
      message:
        "The scaffold is in place. Add filters, switch group logic between AND and OR, and click Search to validate the flow.",
    },
    ui: {
      hasSearched: false,
      isSearching: false,
      sort: createDefaultSort(),
    },
    referenceData: {
      abilities: SAMPLE_ABILITIES,
      moves: SAMPLE_MOVES,
      types: TYPE_OPTIONS,
    },
  };
}

function loadDraft() {
  try {
    const rawDraft = window.localStorage.getItem(APP_CONFIG.draftStorageKey);

    if (!rawDraft) {
      return createEmptyQuery();
    }

    return hydrateQueryDraft(JSON.parse(rawDraft));
  } catch (error) {
    return createEmptyQuery();
  }
}

function persistDraft(query) {
  try {
    window.localStorage.setItem(
      APP_CONFIG.draftStorageKey,
      JSON.stringify(query)
    );
  } catch (error) {
    return;
  }
}

function updateQuery(updater) {
  store.setState((state) => ({
    ...state,
    query: updater(state.query),
  }));
}

function setStatus(nextStatus) {
  store.setState((state) => ({
    ...state,
    status: nextStatus,
  }));
}

function renderApp(state) {
  renderFilters(filterPanel, state);
  renderStatus(statusPanel, state);
  renderResults(resultsPanel, state);
}

function createDefaultSort() {
  return {
    column: "speciesId",
    direction: "asc",
  };
}

function getNextSort(currentSort, column) {
  if (!currentSort || currentSort.column !== column) {
    return {
      column,
      direction: "asc",
    };
  }

  return {
    column,
    direction: currentSort.direction === "asc" ? "desc" : "asc",
  };
}

async function bootstrapReferenceData() {
  try {
    const [abilityIndex, moveIndex] = await Promise.all([
      api.listAbilities(),
      api.listMoves(),
    ]);

    store.setState((state) => ({
      ...state,
      referenceData: {
        ...state.referenceData,
        abilities: abilityIndex.results.map((entry) => entry.name),
        moves: moveIndex.results.map((entry) => entry.name),
      },
    }));
  } catch (error) {
    return;
  }
}
