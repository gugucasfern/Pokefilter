import { COMPARISON_OPERATORS, LOGICAL_OPERATORS, STAT_OPTIONS } from "../config.js";
import { normalizeApiName } from "../utils/normalize.js";

const allowedStats = new Set(STAT_OPTIONS.map((option) => option.value));
const allowedLogicalOperators = new Set(LOGICAL_OPERATORS);
const allowedComparisonOperators = new Set(COMPARISON_OPERATORS);

export function createRuleId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function createStatRule(overrides = {}) {
  return {
    id: createRuleId(),
    stat: "speed",
    operator: ">=",
    value: "",
    ...overrides,
  };
}

export function createEmptyQuery() {
  return {
    abilities: [],
    types: [],
    moves: [],
    stats: [],
    operators: {
      abilities: "and",
      types: "and",
      moves: "and",
      stats: "and",
    },
  };
}

export function hydrateQueryDraft(draft = {}) {
  return {
    abilities: sanitizeTokenGroup(draft.abilities),
    types: sanitizeTokenGroup(draft.types),
    moves: sanitizeTokenGroup(draft.moves),
    stats: sanitizeStatRules(draft.stats),
    operators: {
      abilities: sanitizeLogicalOperator(draft?.operators?.abilities),
      types: sanitizeLogicalOperator(draft?.operators?.types),
      moves: sanitizeLogicalOperator(draft?.operators?.moves),
      stats: sanitizeLogicalOperator(draft?.operators?.stats),
    },
  };
}

export function hasActiveFilters(query) {
  return countActiveFilters(query) > 0;
}

export function countActiveFilters(query) {
  const filledStatRules = query.stats.filter(isFilledStatRule);

  return (
    query.abilities.length +
    query.types.length +
    query.moves.length +
    filledStatRules.length
  );
}

export function countActiveGroups(query) {
  return ["abilities", "types", "moves"].reduce(
    (count, group) => count + (query[group].length > 0 ? 1 : 0),
    query.stats.some(isFilledStatRule) ? 1 : 0
  );
}

export function isFilledStatRule(rule) {
  return rule.value !== "" && Number.isFinite(Number(rule.value));
}

function sanitizeTokenGroup(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map(normalizeApiName).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function sanitizeLogicalOperator(operator) {
  return allowedLogicalOperators.has(operator) ? operator : "and";
}

function sanitizeStatRules(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => {
    const stat = allowedStats.has(value?.stat) ? value.stat : "speed";
    const operator = allowedComparisonOperators.has(value?.operator)
      ? value.operator
      : ">=";
    const numericValue =
      value?.value === "" || value?.value === undefined || value?.value === null
        ? ""
        : Number(value.value);

    return createStatRule({
      id: value?.id || createRuleId(),
      stat,
      operator,
      value: Number.isFinite(numericValue) ? numericValue : "",
    });
  });
}

