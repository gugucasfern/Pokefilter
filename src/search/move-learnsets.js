export const CUSTOM_MOVE_LEARNSETS = {
  "pokemon-champions": {
    // PokeAPI does not expose Pokemon Champions as a version group yet.
    // Keep Scarlet/Violet as the baseline and add verified Champions deltas here.
    baseVersionGroup: "scarlet-violet",
    moveOverrides: {},
  },
};

export function getResolvedMoveVersionGroup(
  versionGroup,
  customMoveLearnsets = CUSTOM_MOVE_LEARNSETS
) {
  return customMoveLearnsets[versionGroup]?.baseVersionGroup || versionGroup;
}

export function getCustomMoveCandidates(
  moveName,
  versionGroup,
  customMoveLearnsets = CUSTOM_MOVE_LEARNSETS
) {
  const source = customMoveLearnsets[versionGroup];
  const override = source?.moveOverrides?.[moveName];

  return {
    added: new Set(override?.add || []),
    removed: new Set(override?.remove || []),
  };
}

export function collectLearnableMoves(
  payload,
  versionGroup,
  customMoveLearnsets = CUSTOM_MOVE_LEARNSETS
) {
  const resolvedVersionGroup = getResolvedMoveVersionGroup(
    versionGroup,
    customMoveLearnsets
  );
  const learnableMoves = new Set(
    (payload.moves || [])
      .filter((entry) =>
        (entry.version_group_details || []).some(
          (detail) =>
            detail?.version_group?.name === resolvedVersionGroup ||
            detail?.version_group?.name === versionGroup
        )
      )
      .map((entry) => entry?.move?.name)
      .filter(Boolean)
  );

  const pokemonName = payload?.name;

  if (!pokemonName) {
    return learnableMoves;
  }

  const source = customMoveLearnsets[versionGroup];

  if (!source) {
    return learnableMoves;
  }

  for (const [moveName, override] of Object.entries(source.moveOverrides || {})) {
    if ((override?.remove || []).includes(pokemonName)) {
      learnableMoves.delete(moveName);
    }

    if ((override?.add || []).includes(pokemonName)) {
      learnableMoves.add(moveName);
    }
  }

  return learnableMoves;
}
