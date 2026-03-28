import { applyCollectionOperator, intersectSets } from "./set-logic.js";
import { countActiveFilters, countActiveGroups, isFilledStatRule } from "./query-model.js";
import { formatStatLabel, humanizeKebabCase } from "../utils/normalize.js";

const DEFAULT_BATCH_CONCURRENCY = 8;

export async function runSearch(query, { api, signal, onProgress } = {}) {
  const preview = buildQueryPreview(query);
  const filterCount = countActiveFilters(query);
  const groupCount = countActiveGroups(query);
  const activeStats = query.stats
    .filter(isFilledStatRule)
    .map((rule) => ({ ...rule, value: Number(rule.value) }));

  const activeSetGroups = [];

  if (query.abilities.length > 0) {
    activeSetGroups.push(
      resolveGroupSet({
        groupKey: "abilities",
        values: query.abilities,
        operator: query.operators.abilities,
        signal,
        onProgress,
        fetchResource: (name, options) => api.getAbility(name, options),
        extractNames: (payload) => payload.pokemon.map((entry) => entry.pokemon.name),
      })
    );
  }

  if (query.types.length > 0) {
    activeSetGroups.push(
      resolveGroupSet({
        groupKey: "types",
        values: query.types,
        operator: query.operators.types,
        signal,
        onProgress,
        fetchResource: (name, options) => api.getType(name, options),
        extractNames: (payload) => payload.pokemon.map((entry) => entry.pokemon.name),
      })
    );
  }

  if (query.moves.length > 0) {
    activeSetGroups.push(
      resolveGroupSet({
        groupKey: "moves",
        values: query.moves,
        operator: query.operators.moves,
        signal,
        onProgress,
        fetchResource: (name, options) => api.getMove(name, options),
        extractNames: (payload) => payload.learned_by_pokemon.map((entry) => entry.name),
      })
    );
  }

  const resolvedGroups = await Promise.all(activeSetGroups);
  const invalidGroups = resolvedGroups.filter((group) => group.invalidValues.length > 0);

  if (invalidGroups.length > 0) {
    return {
      results: [],
      preview,
      status: {
        tone: "warning",
        title: "Some filters were not found",
        message: invalidGroups
          .map((group) => {
            const label = humanizeKebabCase(group.groupKey);
            return `${label}: ${group.invalidValues.join(", ")}`;
          })
          .join(" | "),
      },
    };
  }

  let candidateNames = null;

  if (resolvedGroups.length > 0) {
    candidateNames = [...intersectSets(resolvedGroups.map((group) => group.matches))];

    if (candidateNames.length === 0) {
      return {
        results: [],
        preview,
        status: {
          tone: "warning",
          title: "No matching Pokemon found",
          message: `The active ${groupCount} group search returned no shared candidates for ${filterCount} filter${
            filterCount === 1 ? "" : "s"
          }.`,
        },
      };
    }
  }

  if (!candidateNames) {
    onProgress?.({
      tone: "loading",
      title: "Loading Pokemon index",
      message: "No ability, type or move filter was provided, so the search is expanding to all Pokemon forms before applying base stats.",
    });

    candidateNames = await listAllPokemonNames({ api, signal });
  }

  onProgress?.({
    tone: "loading",
    title: "Hydrating Pokemon details",
    message: `Fetching details for ${candidateNames.length} candidate form${
      candidateNames.length === 1 ? "" : "s"
    }.`,
  });

  const pokemonPayloads = await fetchPokemonBatch(candidateNames, {
    api,
    signal,
    onProgress,
  });

  const normalizedResults = pokemonPayloads
    .map(normalizePokemonResult)
    .filter((pokemon) => matchesStatRules(pokemon.stats, activeStats, query.operators.stats))
    .sort(sortPokemonResults);

  if (normalizedResults.length === 0) {
    return {
      results: [],
      preview,
      status: {
        tone: "warning",
        title: "No matching Pokemon found",
        message:
          activeStats.length > 0
            ? "Candidates matched the ability, type or move filters, but none passed the selected base stat rules."
            : "No Pokemon matched the current query.",
      },
    };
  }

  return {
    results: normalizedResults,
    preview,
    status: {
      tone: "info",
      title: "Search complete",
      message: `Found ${normalizedResults.length} matching Pokemon form${
        normalizedResults.length === 1 ? "" : "s"
      } from ${candidateNames.length} hydrated candidate${
        candidateNames.length === 1 ? "" : "s"
      }.`,
    },
  };
}

export function buildQueryPreview(query) {
  const sections = [];

  if (query.abilities.length > 0) {
    sections.push(
      `Abilities (${query.operators.abilities.toUpperCase()}): ${query.abilities
        .map(humanizeKebabCase)
        .join(", ")}`
    );
  }

  if (query.types.length > 0) {
    sections.push(
      `Types (${query.operators.types.toUpperCase()}): ${query.types
        .map(humanizeKebabCase)
        .join(", ")}`
    );
  }

  if (query.moves.length > 0) {
    sections.push(
      `Moves (${query.operators.moves.toUpperCase()}): ${query.moves
        .map(humanizeKebabCase)
        .join(", ")}`
    );
  }

  const activeStats = query.stats.filter(isFilledStatRule);

  if (activeStats.length > 0) {
    sections.push(
      `Stats (${query.operators.stats.toUpperCase()}): ${activeStats
        .map(
          (rule) =>
            `${formatStatLabel(rule.stat)} ${rule.operator} ${Number(rule.value)}`
        )
        .join(", ")}`
    );
  }

  return sections.join(" | ");
}

async function resolveGroupSet({
  groupKey,
  values,
  operator,
  signal,
  onProgress,
  fetchResource,
  extractNames,
}) {
  onProgress?.({
    tone: "loading",
    title: `Resolving ${humanizeKebabCase(groupKey)}`,
    message: `Checking ${values.length} ${groupKey} filter${values.length === 1 ? "" : "s"} with ${operator.toUpperCase()} logic.`,
  });

  const lookups = await Promise.all(
    values.map(async (value) => {
      try {
        const payload = await fetchResource(value, { signal });
        return {
          ok: true,
          value,
          matches: new Set(extractNames(payload)),
        };
      } catch (error) {
        if (error?.name === "AbortError") {
          throw error;
        }

        return {
          ok: false,
          value,
          error,
        };
      }
    })
  );

  const invalidValues = [];
  const sets = [];

  for (const lookup of lookups) {
    if (lookup.ok) {
      sets.push(lookup.matches);
      continue;
    }

    if (lookup.error?.status === 404) {
      invalidValues.push(lookup.value);
      continue;
    }

    throw lookup.error;
  }

  return {
    groupKey,
    invalidValues,
    matches: applyCollectionOperator(sets, operator),
  };
}

async function listAllPokemonNames({ api, signal }) {
  const summary = await api.listPokemon(1, { signal });
  const completeIndex = await api.listPokemon(summary.count, { signal });
  return completeIndex.results.map((entry) => entry.name);
}

async function fetchPokemonBatch(names, { api, signal, onProgress }) {
  const results = new Array(names.length);
  const workerCount = Math.min(DEFAULT_BATCH_CONCURRENCY, names.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < names.length) {
      if (signal?.aborted) {
        throw createAbortError();
      }

      const currentIndex = nextIndex;
      nextIndex += 1;

      const payload = await api.getPokemon(names[currentIndex], { signal });
      results[currentIndex] = payload;
      completed += 1;

      if (completed === names.length || completed % 10 === 0 || names.length <= 10) {
        onProgress?.({
          tone: "loading",
          title: "Hydrating Pokemon details",
          message: `Fetched ${completed} of ${names.length} candidate form${
            names.length === 1 ? "" : "s"
          }.`,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.filter(Boolean);
}

function normalizePokemonResult(payload) {
  return {
    id: payload.id,
    speciesId: parseSpeciesId(payload),
    name: payload.name,
    sprite:
      payload?.sprites?.other?.["official-artwork"]?.front_default ||
      payload?.sprites?.front_default ||
      null,
    types: [...payload.types]
      .sort((left, right) => left.slot - right.slot)
      .map((entry) => entry.type.name),
    abilities: [...payload.abilities]
      .sort((left, right) => left.slot - right.slot)
      .map((entry) => entry.ability.name),
    stats: payload.stats.reduce((accumulator, entry) => {
      accumulator[entry.stat.name] = entry.base_stat;
      return accumulator;
    }, {}),
  };
}

function parseSpeciesId(payload) {
  const speciesUrl = payload?.species?.url;

  if (speciesUrl) {
    const match = speciesUrl.match(/\/pokemon-species\/(\d+)\/?$/);
    if (match) {
      return Number(match[1]);
    }
  }

  return payload.id;
}

function matchesStatRules(stats, rules, operator) {
  if (rules.length === 0) {
    return true;
  }

  const evaluations = rules.map((rule) => compareStat(stats[rule.stat], rule.operator, rule.value));
  return operator === "or" ? evaluations.some(Boolean) : evaluations.every(Boolean);
}

function compareStat(currentValue, operator, targetValue) {
  if (!Number.isFinite(currentValue)) {
    return false;
  }

  if (operator === ">=") {
    return currentValue >= targetValue;
  }

  if (operator === "<=") {
    return currentValue <= targetValue;
  }

  return currentValue === targetValue;
}

function sortPokemonResults(left, right) {
  const speciesComparison = (left.speciesId ?? left.id) - (right.speciesId ?? right.id);
  if (speciesComparison !== 0) {
    return speciesComparison;
  }

  const nameComparison = left.name.localeCompare(right.name);
  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.id - right.id;
}

function createAbortError() {
  return new DOMException("The search was aborted.", "AbortError");
}
