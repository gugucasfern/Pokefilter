export const CUSTOM_POKEMON_FORMS = {
  "pokemon-champions": [
    {
      name: "mega-emboar",
      basePokemon: "emboar",
      speciesName: "emboar",
      speciesId: 500,
      types: ["fire", "fighting"],
      abilities: ["mold-breaker"],
      moves: ["hammer-arm"],
    },
  ],
};

export function getCustomPokemonForms(
  versionGroup,
  customPokemonForms = CUSTOM_POKEMON_FORMS
) {
  return customPokemonForms[versionGroup] || [];
}

export function getCustomPokemonNames(versionGroup, customPokemonForms) {
  return getCustomPokemonForms(versionGroup, customPokemonForms).map((form) => form.name);
}

export function getCustomNamesForAbility(abilityName, versionGroup, customPokemonForms) {
  return getCustomPokemonForms(versionGroup, customPokemonForms)
    .filter((form) => form.abilities.includes(abilityName))
    .map((form) => form.name);
}

export function getCustomNamesForType(typeName, versionGroup, customPokemonForms) {
  return getCustomPokemonForms(versionGroup, customPokemonForms)
    .filter((form) => form.types.includes(typeName))
    .map((form) => form.name);
}

export function getCustomNamesForMove(moveName, versionGroup, customPokemonForms) {
  return getCustomPokemonForms(versionGroup, customPokemonForms)
    .filter((form) => form.moves.includes(moveName))
    .map((form) => form.name);
}

export async function resolveCustomPokemonPayload(name, versionGroup, { api, customPokemonForms }) {
  const form = getCustomPokemonForms(versionGroup, customPokemonForms).find(
    (customForm) => customForm.name === name
  );

  if (!form) {
    return null;
  }

  const basePayload = await api.getPokemon(form.basePokemon);

  return {
    ...basePayload,
    id: form.id || basePayload.id,
    name: form.name,
    species: {
      name: form.speciesName,
      url: `https://pokeapi.co/api/v2/pokemon-species/${form.speciesId}/`,
    },
    types: form.types.map((type, index) => ({
      slot: index + 1,
      type: { name: type },
    })),
    abilities: form.abilities.map((ability, index) => ({
      slot: index + 1,
      ability: { name: ability },
    })),
    moves: mergeCustomMoves(basePayload.moves || [], form.moves, versionGroup),
  };
}

function mergeCustomMoves(baseMoves, customMoves, versionGroup) {
  const movesByName = new Map(baseMoves.map((entry) => [entry?.move?.name, entry]));

  for (const moveName of customMoves) {
    const existingEntry = movesByName.get(moveName);

    if (existingEntry) {
      movesByName.set(moveName, {
        ...existingEntry,
        version_group_details: [
          ...(existingEntry.version_group_details || []),
          { version_group: { name: versionGroup } },
        ],
      });
      continue;
    }

    movesByName.set(moveName, {
      move: { name: moveName },
      version_group_details: [{ version_group: { name: versionGroup } }],
    });
  }

  return [...movesByName.values()];
}
