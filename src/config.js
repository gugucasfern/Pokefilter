export const APP_CONFIG = {
  appName: "DexQuery",
  pokeApiBaseUrl: "https://pokeapi.co/api/v2",
  cacheNamespace: "dexquery",
  cacheVersion: "v2",
  draftStorageKey: "dexquery:query-draft",
  defaultVersionGroup: "scarlet-violet",
};

export const TYPE_OPTIONS = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

export const SAMPLE_ABILITIES = [
  "intimidate",
  "levitate",
  "moxie",
  "prankster",
  "regenerator",
  "flash-fire",
];

export const SAMPLE_MOVES = [
  "parting-shot",
  "u-turn",
  "knock-off",
  "will-o-wisp",
  "earthquake",
  "sucker-punch",
];

export const SAMPLE_EGG_GROUPS = [
  "field",
  "monster",
  "dragon",
  "water-1",
  "human-like",
  "undiscovered",
];

export const MOVE_LEARNSET_OPTIONS = [
  { value: "red-blue", label: "Gen 1 (Red/Blue)" },
  { value: "gold-silver", label: "Gen 2 (Gold/Silver)" },
  { value: "ruby-sapphire", label: "Gen 3 (Ruby/Sapphire)" },
  { value: "diamond-pearl", label: "Gen 4 (Diamond/Pearl)" },
  { value: "black-white", label: "Gen 5 (Black/White)" },
  { value: "x-y", label: "Gen 6 (X/Y)" },
  { value: "sun-moon", label: "Gen 7 (Sun/Moon)" },
  { value: "sword-shield", label: "Gen 8 (Sword/Shield)" },
  { value: "scarlet-violet", label: "Gen 9 (Scarlet/Violet)" },
];

export function getMoveLearnsetLabel(value) {
  return (
    MOVE_LEARNSET_OPTIONS.find((option) => option.value === value)?.label ||
    value
  );
}

export const STAT_OPTIONS = [
  { value: "hp", label: "HP" },
  { value: "attack", label: "Attack" },
  { value: "defense", label: "Defense" },
  { value: "special-attack", label: "Sp. Attack" },
  { value: "special-defense", label: "Sp. Defense" },
  { value: "speed", label: "Speed" },
];

export const LOGICAL_OPERATORS = ["and", "or"];
export const COMPARISON_OPERATORS = [">=", "<=", "="];
