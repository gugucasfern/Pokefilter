import { escapeHtml, humanizeKebabCase } from "../utils/normalize.js";

const sortableColumns = [
  { key: "speciesId", label: "#" },
  { key: "name", label: "Pokemon" },
  { key: "types", label: "Types" },
  { key: "abilities", label: "Abilities" },
  { key: "eggGroups", label: "Egg Groups" },
  { key: "hp", label: "HP" },
  { key: "attack", label: "Atk" },
  { key: "defense", label: "Def" },
  { key: "special-attack", label: "Sp. Atk" },
  { key: "special-defense", label: "Sp. Def" },
  { key: "speed", label: "Speed" },
];

export function bindResults(container, actions) {
  if (container.dataset.bound === "true") {
    return;
  }

  container.dataset.bound = "true";

  container.addEventListener("click", (event) => {
    const sortTrigger = event.target.closest("[data-sort-column]");

    if (!sortTrigger) {
      return;
    }

    actions.toggleSort(sortTrigger.dataset.sortColumn);
  });
}

export function renderResults(container, state) {
  const { results, ui, lastSearchPreview, status } = state;
  const sortedResults = sortResults(results, ui.sort);

  if (ui.isSearching) {
    container.innerHTML = `
      <div class="loading-state">
        <span class="panel-kicker">Searching</span>
        <h3>${escapeHtml(status.title)}</h3>
        <p>${escapeHtml(status.message)}</p>
      </div>
    `;
    return;
  }

  if (sortedResults.length > 0) {
    container.innerHTML = `
      <div class="query-preview query-preview-inline">
        <span class="panel-kicker">Search summary</span>
        <h3>${escapeHtml(status.title)}</h3>
        <p>${escapeHtml(status.message)}</p>
      </div>

      <div class="results-table-shell">
        <table class="results-table">
          <thead>
            <tr>
              ${sortableColumns
                .map((column) => renderHeaderCell(column, ui.sort))
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${sortedResults.map(renderResultRow).join("")}
          </tbody>
        </table>
      </div>
    `;
    return;
  }

  if (ui.hasSearched) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="panel-kicker">Search result</span>
        <h3>${escapeHtml(status.title)}</h3>
        <p>${escapeHtml(status.message)}</p>
        <p>${escapeHtml(lastSearchPreview || "No query preview available yet.")}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="empty-state">
      <span class="panel-kicker">No results yet</span>
      <h3>Build a targeted search</h3>
      <p>
        Add abilities, moves, types or stat rules, then click Search to load a
        proper database-style listing of the matching Pokemon, including egg groups.
      </p>
    </div>
  `;
}

function renderHeaderCell(column, activeSort) {
  const isActive = activeSort?.column === column.key;
  const direction = isActive ? activeSort.direction : "";
  const directionLabel = direction === "desc" ? "descending" : "ascending";
  const indicator = !isActive ? "<>" : direction === "desc" ? "v" : "^";

  return `
    <th scope="col">
      <button
        class="sort-button ${isActive ? "is-active" : ""}"
        type="button"
        data-sort-column="${column.key}"
        aria-label="Sort by ${column.label} ${directionLabel}"
      >
        <span>${escapeHtml(column.label)}</span>
        <span class="sort-indicator">${indicator}</span>
      </button>
    </th>
  `;
}

function renderResultRow(result) {
  const spriteMarkup = result.sprite
    ? `<img class="pokemon-cell-sprite" src="${escapeHtml(result.sprite)}" alt="${escapeHtml(result.name)} sprite" loading="lazy" />`
    : `<div class="pokemon-cell-sprite pokemon-cell-sprite-fallback">?</div>`;

  return `
    <tr>
      <td class="id-cell">${formatDexId(result.speciesId ?? result.id)}</td>
      <td>
        <div class="pokemon-cell">
          ${spriteMarkup}
          <div class="pokemon-cell-copy">
            <strong>${escapeHtml(humanizeKebabCase(result.name))}</strong>
            <span>${escapeHtml(result.name)}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="type-stack">
          ${result.types.map(renderTypeBadge).join("")}
        </div>
      </td>
      <td>
        <div class="ability-stack">
          ${result.abilities
            .map((ability) => `<span>${escapeHtml(humanizeKebabCase(ability))}</span>`)
            .join("")}
        </div>
      </td>
      <td>
        <div class="egg-group-stack">
          ${renderEggGroupMarkup(result.eggGroups)}
        </div>
      </td>
      <td>${result.stats.hp ?? "-"}</td>
      <td>${result.stats.attack ?? "-"}</td>
      <td>${result.stats.defense ?? "-"}</td>
      <td>${result.stats["special-attack"] ?? "-"}</td>
      <td>${result.stats["special-defense"] ?? "-"}</td>
      <td>${result.stats.speed ?? "-"}</td>
    </tr>
  `;
}

function renderTypeBadge(type) {
  return `
    <span class="type-badge type-${escapeHtml(type)}">
      ${escapeHtml(humanizeKebabCase(type))}
    </span>
  `;
}

function renderEggGroupMarkup(eggGroups = []) {
  if (!eggGroups.length) {
    return '<span class="egg-group-empty">-</span>';
  }

  return eggGroups
    .map(
      (eggGroup) => `
        <span class="egg-group-badge">
          ${escapeHtml(humanizeKebabCase(eggGroup))}
        </span>
      `
    )
    .join("");
}

function formatDexId(id) {
  return String(id).padStart(4, "0");
}

function sortResults(results, sort) {
  const workingCopy = [...results];

  return workingCopy.sort((left, right) => {
    const leftValue = getSortableValue(left, sort?.column);
    const rightValue = getSortableValue(right, sort?.column);
    const directionFactor = sort?.direction === "desc" ? -1 : 1;

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      const numericComparison = leftValue - rightValue;
      if (numericComparison !== 0) {
        return numericComparison * directionFactor;
      }
    } else {
      const stringComparison = String(leftValue).localeCompare(String(rightValue));
      if (stringComparison !== 0) {
        return stringComparison * directionFactor;
      }
    }

    const speciesComparison = (left.speciesId ?? left.id) - (right.speciesId ?? right.id);
    if (speciesComparison !== 0) {
      return speciesComparison;
    }

    return left.name.localeCompare(right.name);
  });
}

function getSortableValue(result, column) {
  if (column === "speciesId") {
    return result.speciesId ?? result.id;
  }

  if (column === "name") {
    return result.name;
  }

  if (column === "types") {
    return result.types.join("|");
  }

  if (column === "abilities") {
    return result.abilities.join("|");
  }

  if (column === "eggGroups") {
    return result.eggGroups.join("|");
  }

  if (column && column in result.stats) {
    return result.stats[column];
  }

  return "";
}
