import { applyCollectionOperator, intersectSets } from "./set-logic.js";
import { countActiveFilters, countActiveGroups, isFilledStatRule } from "./query-model.js";
import { APP_CONFIG, getMoveLearnsetLabel } from "../config.js";
import { formatStatLabel, humanizeKebabCase } from "../utils/normalize.js";

const DEFAULT_BATCH_CONCURRENCY = 8;

export async function runSearch(query, { api, signal, onProgress } = {}) {
  const versionGroup = query.moveVersionGroup || APP_CONFIG.defaultVersionGroup;
  const versionGroupLabel = getMoveLearnsetLabel(versionGroup);
  const preview = buildQueryPreview(query);
  const filterCount = countActiveFilters(query);
  const groupCount = countActiveGroups(query);
  const activeStats = query.stats
    .filter(isFilledStatRule)
    .map((rule) => ({ ...rule, value: Number(rule.value) }));

  const activeFormSetGroups = [];

  if (query.abilities.length > 0) {
    activeFormSetGroups.push(
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
    activeFormSetGroups.push(
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
    activeFormSetGroups.push(
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

  if (query.eggGroups.length > 0) {
    activeFormSetGroups.push(
      resolveGroupSet({
        groupKey: "egg-groups",
        values: query.eggGroups,
        operator: query.operators.eggGroups,
        signal,
        onProgress,
        fetchResource: (name, options) => api.getEggGroup(name, options),
        extractNames: (payload) => payload.pokemon_species.map((entry) => entry.name),
      })
    );
  }

  const resolvedGroups = await Promise.all(activeFormSetGroups);
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

  const eggGroupGroup = resolvedGroups.find((group) => group.groupKey === "egg-groups");
  const formGroups = resolvedGroups.filter((group) => group.groupKey !== "egg-groups");
  const matchedSpeciesNameSet = eggGroupGroup ? eggGroupGroup.matches : null;
  let candidateNames = null;

  if (formGroups.length > 0) {
    candidateNames = [...intersectSets(formGroups.map((group) => group.matches))];

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
  } else if (matchedSpeciesNameSet) {
    candidateNames = await expandSpeciesNamesToPokemonNames([...matchedSpeciesNameSet], {
      api,
      signal,
      onProgress,
    });

    if (candidateNames.length === 0) {
      return {
        results: [],
        preview,
        status: {
          tone: "warning",
          title: "No matching Pokemon found",
          message: `The active ${groupCount} group search returned no playable forms for ${filterCount} filter${
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
      message:
        "No form-level filter was provided, so the search is expanding to all Pokemon forms before applying egg group and stat rules.",
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

  const candidatePayloads = matchedSpeciesNameSet
    ? pokemonPayloads.filter((payload) => matchedSpeciesNameSet.has(payload?.species?.name))
    : pokemonPayloads;

  const moveMatchedPayloads = candidatePayloads.filter((payload) =>
    matchesMoveRules(payload, query.moves, query.operators.moves, versionGroup)
  );

  const statMatchedPayloads = moveMatchedPayloads.filter((payload) =>
    matchesStatRules(extractPokemonStats(payload), activeStats, query.operators.stats)
  );

  const speciesPayloads = await fetchSpeciesBatch(
    [...new Set(statMatchedPayloads.map((payload) => payload?.species?.name).filter(Boolean))],
    {
      api,
      signal,
      onProgress,
    }
  );
  const speciesByName = new Map(speciesPayloads.map((payload) => [payload.name, payload]));

  const normalizedResults = statMatchedPayloads
    .map((payload) => normalizePokemonResult(payload, speciesByName.get(payload?.species?.name)))
    .sort(sortPokemonResults);

  if (normalizedResults.length === 0) {
    return {
      results: [],
      preview,
      status: {
        tone: "warning",
        title: "No matching Pokemon found",
        message:
          query.moves.length > 0 && activeStats.length > 0
            ? `Candidates matched the broad filters, but none kept the selected moves in ${versionGroupLabel} while also passing the selected base stat rules.`
            : query.moves.length > 0
              ? `Candidates matched the broad filters, but none keep the selected moves in ${versionGroupLabel}.`
              : activeStats.length > 0
                ? "Candidates matched the ability, type, egg group or move filters, but none passed the selected base stat rules."
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
      message: `Found ${normalizedResults.length} Pokemon result${
        normalizedResults.length === 1 ? "" : "s"
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
        .join(", ")} [${getMoveLearnsetLabel(
          query.moveVersionGroup || APP_CONFIG.defaultVersionGroup
        )}]`
    );
  }

  if (query.eggGroups.length > 0) {
    sections.push(
      `Egg Groups (${query.operators.eggGroups.toUpperCase()}): ${query.eggGroups
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

async function expandSpeciesNamesToPokemonNames(speciesNames, { api, signal, onProgress }) {
  onProgress?.({
    tone: "loading",
    title: "Expanding egg group species",
    message: `Resolving ${speciesNames.length} species into their available Pokemon forms.`,
  });

  const speciesPayloads = await fetchSpeciesBatch(speciesNames, {
    api,
    signal,
    onProgress,
    title: "Expanding egg group species",
    progressNoun: "species",
  });

  const formNames = new Set();

  for (const payload of speciesPayloads) {
    for (const variety of payload.varieties || []) {
      if (variety?.pokemon?.name) {
        formNames.add(variety.pokemon.name);
      }
    }
  }

  return [...formNames].sort((left, right) => left.localeCompare(right));
}

async function fetchSpeciesBatch(
  names,
  { api, signal, onProgress, title = "Loading species data", progressNoun = "species" }
) {
  if (names.length === 0) {
    return [];
  }

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

      const payload = await api.getPokemonSpecies(names[currentIndex], { signal });
      results[currentIndex] = payload;
      completed += 1;

      if (completed === names.length || completed % 10 === 0 || names.length <= 10) {
        onProgress?.({
          tone: "loading",
          title,
          message: `Fetched ${completed} of ${names.length} ${progressNoun}.`,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.filter(Boolean);
}

function normalizePokemonResult(payload, speciesPayload) {
  return {
    id: payload.id,
    speciesId: speciesPayload?.id || parseSpeciesId(payload),
    speciesName: payload?.species?.name || speciesPayload?.name || payload.name,
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
    eggGroups: [...(speciesPayload?.egg_groups || [])].map((entry) => entry.name),
    stats: extractPokemonStats(payload),
  };
}

function extractPokemonStats(payload) {
  return payload.stats.reduce((accumulator, entry) => {
    accumulator[entry.stat.name] = entry.base_stat;
    return accumulator;
  }, {});
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

function matchesMoveRules(payload, moveNames, operator, versionGroup) {
  if (moveNames.length === 0) {
    return true;
  }

  const learnableMoves = new Set(
    (payload.moves || [])
      .filter((entry) =>
        (entry.version_group_details || []).some(
          (detail) => detail?.version_group?.name === versionGroup
        )
      )
      .map((entry) => entry?.move?.name)
      .filter(Boolean)
  );

  const evaluations = moveNames.map((moveName) => learnableMoves.has(moveName));
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
