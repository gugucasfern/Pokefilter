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
  });

  const result = await runSearch(
    {
      abilities: ["intimidate"],
      types: ["dark"],
      moves: ["parting-shot"],
      stats: [{ id: "1", stat: "speed", operator: ">=", value: 60 }],
      operators: {
        abilities: "and",
        types: "and",
        moves: "and",
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
  });

  const result = await runSearch(
    {
      abilities: ["intimidate", "moxie"],
      types: ["dark"],
      moves: [],
      stats: [],
      operators: {
        abilities: "or",
        types: "and",
        moves: "and",
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
      stats: [],
      operators: {
        abilities: "and",
        types: "and",
        moves: "and",
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
        stats: defaultStats({ speed: 126 }),
      }),
      slowbro: createPokemonPayload({
        id: 80,
        name: "slowbro",
        types: ["water", "psychic"],
        abilities: ["oblivious", "own-tempo"],
        stats: defaultStats({ speed: 30 }),
      }),
      snorlax: createPokemonPayload({
        id: 143,
        name: "snorlax",
        types: ["normal"],
        abilities: ["immunity", "thick-fat"],
        stats: defaultStats({ speed: 30, attack: 110 }),
      }),
    },
  });

  const result = await runSearch(
    {
      abilities: [],
      types: [],
      moves: [],
      stats: [{ id: "1", stat: "speed", operator: ">=", value: 100 }],
      operators: {
        abilities: "and",
        types: "and",
        moves: "and",
        stats: "and",
      },
    },
    { api }
  );

  assert.equal(result.status.tone, "info");
  assert.deepEqual(result.results.map((pokemon) => pokemon.name), ["talonflame"]);
});

function createMockApi({
  abilities = {},
  types = {},
  moves = {},
  pokemon = {},
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

function createPokemonPayload({ id, name, types, abilities, stats }) {
  return {
    id,
    name,
    species: {
      name,
      url: `https://pokeapi.co/api/v2/pokemon-species/${id}/`,
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
    stats: Object.entries(stats).map(([statName, baseStat]) => ({
      stat: { name: statName },
      base_stat: baseStat,
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
