import test from "node:test";
import assert from "node:assert/strict";

import { runSearch } from "../src/search/query-engine.js";

test("returns the intersected Pokemon for strict ability, type, move and stat filters", async () => {
  const api = createMockApi({
    abilities: {
      intimidate: ["incineroar", "scrafty"],
    },
    types: {
      dark: ["incineroar", "greninja"],
    },
    moves: {
      "parting-shot": ["incineroar", "pangoro"],
    },
    pokemon: {
      incineroar: createPokemonPayload({
        id: 727,
        name: "incineroar",
        types: ["fire", "dark"],
        abilities: ["blaze", "intimidate"],
        moves: {
          "parting-shot": ["scarlet-violet"],
        },
        stats: {
          hp: 95,
          attack: 115,
          defense: 90,
          "special-attack": 80,
          "special-defense": 90,
          speed: 60,
        },
      }),
    },
    species: {
      incineroar: createSpeciesPayload({
        id: 727,
        name: "incineroar",
        eggGroups: ["field"],
        varieties: ["incineroar"],
      }),
    },
  });

  const result = await runSearch(
    {
      abilities: ["intimidate"],
      types: ["dark"],
      moves: ["parting-shot"],
      moveVersionGroup: "scarlet-violet",
      eggGroups: [],
      stats: [{ id: "1", stat: "speed", operator: ">=", value: 60 }],
      operators: {
        abilities: "and",
        types: "and",
        moves: "and",
        eggGroups: "and",
        stats: "and",
      },
    },
    { api }
  );

  assert.equal(result.status.tone, "info");
  assert.deepEqual(result.results.map((pokemon) => pokemon.name), ["incineroar"]);
});

test("supports OR logic inside a filter group", async () => {
  const api = createMockApi({
    abilities: {
      intimidate: ["incineroar", "scrafty"],
      moxie: ["krookodile"],
    },
    types: {
      dark: ["incineroar", "krookodile", "greninja"],
    },
    pokemon: {
      incineroar: createPokemonPayload({
        id: 727,
        name: "incineroar",
        types: ["fire", "dark"],
        abilities: ["blaze", "intimidate"],
        stats: defaultStats({ speed: 60 }),
      }),
      krookodile: createPokemonPayload({
        id: 553,
        name: "krookodile",
        types: ["ground", "dark"],
        abilities: ["intimidate", "moxie"],
        stats: defaultStats({ speed: 92, attack: 117 }),
      }),
    },
    species: {
      incineroar: createSpeciesPayload({
        id: 727,
        name: "incineroar",
        eggGroups: ["field"],
        varieties: ["incineroar"],
      }),
      krookodile: createSpeciesPayload({
        id: 553,
        name: "krookodile",
        eggGroups: ["field"],
        varieties: ["krookodile"],
      }),
    },
  });

  const result = await runSearch(
    {
      abilities: ["intimidate", "moxie"],
      types: ["dark"],
      moves: [],
      moveVersionGroup: "scarlet-violet",
      eggGroups: [],
      stats: [],
      operators: {
        abilities: "or",
        types: "and",
        moves: "and",
        eggGroups: "and",
        stats: "and",
      },
    },
    { api }
  );

  assert.equal(result.status.tone, "info");
  assert.deepEqual(result.results.map((pokemon) => pokemon.name), [
    "krookodile",
    "incineroar",
  ]);
});

test("returns a warning when a filter value does not exist", async () => {
  const api = createMockApi();

  const result = await runSearch(
    {
      abilities: ["made-up-ability"],
      types: [],
      moves: [],
      moveVersionGroup: "scarlet-violet",
      eggGroups: [],
      stats: [],
      operators: {
        abilities: "and",
        types: "and",
        moves: "and",
        eggGroups: "and",
        stats: "and",
      },
    },
    { api }
  );

  assert.equal(result.status.tone, "warning");
  assert.equal(result.results.length, 0);
  assert.match(result.status.message, /made-up-ability/);
});

test("falls back to the full Pokemon index when the query only has stat rules", async () => {
  const api = createMockApi({
    pokemonIndex: ["talonflame", "slowbro", "snorlax"],
    pokemon: {
      talonflame: createPokemonPayload({
        id: 663,
        name: "talonflame",
        types: ["fire", "flying"],
        abilities: ["flame-body", "gale-wings"],
        moves: {},
        stats: defaultStats({ speed: 126 }),
      }),
      slowbro: createPokemonPayload({
        id: 80,
        name: "slowbro",
        types: ["water", "psychic"],
        abilities: ["oblivious", "own-tempo"],
        moves: {},
        stats: defaultStats({ speed: 30 }),
      }),
      snorlax: createPokemonPayload({
        id: 143,
        name: "snorlax",
        types: ["normal"],
        abilities: ["immunity", "thick-fat"],
        moves: {},
        stats: defaultStats({ speed: 30, attack: 110 }),
      }),
    },
    species: {
      talonflame: createSpeciesPayload({
        id: 663,
        name: "talonflame",
        eggGroups: ["flying"],
        varieties: ["talonflame"],
      }),
      slowbro: createSpeciesPayload({
        id: 80,
        name: "slowbro",
        eggGroups: ["monster", "water-1"],
        varieties: ["slowbro"],
      }),
      snorlax: createSpeciesPayload({
        id: 143,
        name: "snorlax",
        eggGroups: ["monster"],
        varieties: ["snorlax"],
      }),
    },
  });

  const result = await runSearch(
    {
      abilities: [],
      types: [],
      moves: [],
      moveVersionGroup: "scarlet-violet",
      eggGroups: [],
      stats: [{ id: "1", stat: "speed", operator: ">=", value: 100 }],
      operators: {
        abilities: "and",
        types: "and",
        moves: "and",
        eggGroups: "and",
        stats: "and",
      },
    },
    { api }
  );

  assert.equal(result.status.tone, "info");
  assert.deepEqual(result.results.map((pokemon) => pokemon.name), ["talonflame"]);
});

test("filters by egg groups at species level and keeps forms as separate results", async () => {
  const api = createMockApi({
    eggGroups: {
      "water-1": ["tauros"],
      field: ["tauros"],
    },
    pokemon: {
      "tauros-paldea-aqua-breed": createPokemonPayload({
        id: 10252,
        speciesId: 128,
        speciesName: "tauros",
        name: "tauros-paldea-aqua-breed",
        types: ["fighting", "water"],
        abilities: ["intimidate", "anger-point"],
        moves: {},
        stats: defaultStats({ speed: 100, attack: 110, defense: 105 }),
      }),
      "tauros-paldea-blaze-breed": createPokemonPayload({
        id: 10251,
        speciesId: 128,
        speciesName: "tauros",
        name: "tauros-paldea-blaze-breed",
        types: ["fighting", "fire"],
        abilities: ["intimidate", "anger-point"],
        moves: {},
        stats: defaultStats({ speed: 100, attack: 110, defense: 105 }),
      }),
    },
    species: {
      tauros: createSpeciesPayload({
        id: 128,
        name: "tauros",
        eggGroups: ["field"],
        varieties: ["tauros-paldea-aqua-breed", "tauros-paldea-blaze-breed"],
      }),
    },
  });

  const result = await runSearch(
    {
      abilities: [],
      types: [],
      moves: [],
      moveVersionGroup: "scarlet-violet",
      eggGroups: ["field"],
      stats: [],
      operators: {
        abilities: "and",
        types: "and",
        moves: "and",
        eggGroups: "and",
        stats: "and",
      },
    },
    { api }
  );

  assert.equal(result.status.tone, "info");
  assert.deepEqual(result.results.map((pokemon) => pokemon.name), [
    "tauros-paldea-aqua-breed",
    "tauros-paldea-blaze-breed",
  ]);
  assert.deepEqual(result.results[0].eggGroups, ["field"]);
});

test("only counts moves that are learnable in scarlet-violet", async () => {
  const api = createMockApi({
    moves: {
      scald: ["toxapex", "slowbro"],
    },
    pokemon: {
      toxapex: createPokemonPayload({
        id: 748,
        name: "toxapex",
        types: ["poison", "water"],
        abilities: ["merciless", "limber"],
        moves: {
          scald: ["ultra-sun-ultra-moon"],
        },
        stats: defaultStats({ defense: 152 }),
      }),
      slowbro: createPokemonPayload({
        id: 80,
        name: "slowbro",
        types: ["water", "psychic"],
        abilities: ["oblivious", "own-tempo"],
        moves: {
          scald: ["scarlet-violet"],
        },
        stats: defaultStats({ defense: 110 }),
      }),
    },
    species: {
      toxapex: createSpeciesPayload({
        id: 748,
        name: "toxapex",
        eggGroups: ["water-1"],
        varieties: ["toxapex"],
      }),
      slowbro: createSpeciesPayload({
        id: 80,
        name: "slowbro",
        eggGroups: ["monster", "water-1"],
        varieties: ["slowbro"],
      }),
    },
  });

  const result = await runSearch(
    {
      abilities: [],
      types: [],
      moves: ["scald"],
      moveVersionGroup: "scarlet-violet",
      eggGroups: [],
      stats: [],
      operators: {
        abilities: "and",
        types: "and",
        moves: "and",
        eggGroups: "and",
        stats: "and",
      },
    },
    { api }
  );

  assert.equal(result.status.tone, "info");
  assert.deepEqual(result.results.map((pokemon) => pokemon.name), ["slowbro"]);
});

test("allows changing the move learnset version group", async () => {
  const api = createMockApi({
    moves: {
      scald: ["toxapex", "slowbro"],
    },
    pokemon: {
      toxapex: createPokemonPayload({
        id: 748,
        name: "toxapex",
        types: ["poison", "water"],
        abilities: ["merciless", "limber"],
        moves: {
          scald: ["sword-shield"],
        },
        stats: defaultStats({ defense: 152 }),
      }),
      slowbro: createPokemonPayload({
        id: 80,
        name: "slowbro",
        types: ["water", "psychic"],
        abilities: ["oblivious", "own-tempo"],
        moves: {
          scald: ["scarlet-violet", "sword-shield"],
        },
        stats: defaultStats({ defense: 110 }),
      }),
    },
    species: {
      toxapex: createSpeciesPayload({
        id: 748,
        name: "toxapex",
        eggGroups: ["water-1"],
        varieties: ["toxapex"],
      }),
      slowbro: createSpeciesPayload({
        id: 80,
        name: "slowbro",
        eggGroups: ["monster", "water-1"],
        varieties: ["slowbro"],
      }),
    },
  });

  const result = await runSearch(
    {
      abilities: [],
      types: [],
      moves: ["scald"],
      moveVersionGroup: "sword-shield",
      eggGroups: [],
      stats: [],
      operators: {
        abilities: "and",
        types: "and",
        moves: "and",
        eggGroups: "and",
        stats: "and",
      },
    },
    { api }
  );

  assert.equal(result.status.tone, "info");
  assert.deepEqual(result.results.map((pokemon) => pokemon.name), [
    "slowbro",
    "toxapex",
  ]);
});

function createMockApi({
  abilities = {},
  types = {},
  moves = {},
  eggGroups = {},
  pokemon = {},
  species = {},
  pokemonIndex = Object.keys(pokemon),
} = {}) {
  return {
    async getAbility(name) {
      return resolveNamedResource(abilities[name], (names) => ({
        pokemon: names.map((pokemonName) => ({
          pokemon: { name: pokemonName },
        })),
      }));
    },

    async getType(name) {
      return resolveNamedResource(types[name], (names) => ({
        pokemon: names.map((pokemonName) => ({
          pokemon: { name: pokemonName },
        })),
      }));
    },

    async getMove(name) {
      return resolveNamedResource(moves[name], (names) => ({
        learned_by_pokemon: names.map((pokemonName) => ({
          name: pokemonName,
        })),
      }));
    },

    async getEggGroup(name) {
      return resolveNamedResource(eggGroups[name], (names) => ({
        pokemon_species: names.map((speciesName) => ({
          name: speciesName,
        })),
      }));
    },

    async listPokemon(limit = pokemonIndex.length) {
      return {
        count: pokemonIndex.length,
        results: pokemonIndex.slice(0, limit).map((name) => ({ name })),
      };
    },

    async getPokemon(name) {
      if (!pokemon[name]) {
        throw notFoundError(name);
      }

      return pokemon[name];
    },

    async getPokemonSpecies(name) {
      const directSpecies = species[name];

      if (directSpecies) {
        return directSpecies;
      }

      const pokemonPayload = Object.values(pokemon).find(
        (entry) => entry?.species?.name === name || entry?.name === name
      );

      if (!pokemonPayload) {
        throw notFoundError(name);
      }

      return createSpeciesPayload({
        id: parseSpeciesIdFromUrl(pokemonPayload.species.url),
        name: pokemonPayload.species.name,
        eggGroups: [],
        varieties: [pokemonPayload.name],
      });
    },
  };
}

function resolveNamedResource(resource, serializer) {
  if (!resource) {
    throw notFoundError();
  }

  return serializer(resource);
}

function notFoundError(name = "resource") {
  return Object.assign(new Error(`${name} not found`), { status: 404 });
}

function createPokemonPayload({
  id,
  name,
  speciesId = id,
  speciesName,
  types,
  abilities,
  moves = {},
  stats,
}) {
  const resolvedSpeciesName = speciesName || name;

  return {
    id,
    name,
    species: {
      name: resolvedSpeciesName,
      url: `https://pokeapi.co/api/v2/pokemon-species/${speciesId}/`,
    },
    sprites: {
      other: {
        "official-artwork": {
          front_default: `sprite://${name}`,
        },
      },
    },
    types: types.map((type, index) => ({
      slot: index + 1,
      type: { name: type },
    })),
    abilities: abilities.map((ability, index) => ({
      slot: index + 1,
      ability: { name: ability },
    })),
    moves: Object.entries(moves).map(([moveName, versionGroups]) => ({
      move: { name: moveName },
      version_group_details: versionGroups.map((versionGroupName) => ({
        version_group: { name: versionGroupName },
      })),
    })),
    stats: Object.entries(stats).map(([statName, baseStat]) => ({
      stat: { name: statName },
      base_stat: baseStat,
    })),
  };
}

function createSpeciesPayload({ id, name, eggGroups = [], varieties = [name] }) {
  return {
    id,
    name,
    egg_groups: eggGroups.map((eggGroup) => ({
      name: eggGroup,
    })),
    varieties: varieties.map((pokemonName) => ({
      pokemon: { name: pokemonName },
    })),
  };
}

function defaultStats(overrides = {}) {
  return {
    hp: 80,
    attack: 80,
    defense: 80,
    "special-attack": 80,
    "special-defense": 80,
    speed: 80,
    ...overrides,
  };
}

function parseSpeciesIdFromUrl(url) {
  const match = String(url || "").match(/\/pokemon-species\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}
