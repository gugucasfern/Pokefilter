export function intersectSets(sets) {
  if (!sets.length) {
    return new Set();
  }

  const [firstSet, ...rest] = sets;
  const result = new Set(firstSet);

  for (const currentSet of rest) {
    for (const value of result) {
      if (!currentSet.has(value)) {
        result.delete(value);
      }
    }
  }

  return result;
}

export function unionSets(sets) {
  const result = new Set();

  for (const currentSet of sets) {
    for (const value of currentSet) {
      result.add(value);
    }
  }

  return result;
}

export function applyCollectionOperator(sets, operator) {
  if (operator === "or") {
    return unionSets(sets);
  }

  return intersectSets(sets);
}

