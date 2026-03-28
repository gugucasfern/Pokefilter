import {
  COMPARISON_OPERATORS,
  STAT_OPTIONS,
} from "../config.js";
import { escapeHtml, formatStatLabel, humanizeKebabCase } from "../utils/normalize.js";

const groupLabels = {
  abilities: "Abilities",
  types: "Types",
  moves: "Moves",
  stats: "Base Stats",
};

const groupPlaceholders = {
  abilities: "Add an ability, for example intimidate",
  types: "Add a type, for example dark",
  moves: "Add a move, for example parting-shot",
};

const groupDescriptions = {
  abilities: "Use OR when one of several abilities is acceptable.",
  types: "Keep AND for dual-type requirements. Switch to OR for wider matching.",
  moves: "Moves are matched by learnability, regardless of how the Pokemon learns them.",
};

const MAX_SUGGESTIONS = 6;

export function bindFilters(container, actions) {
  if (container.dataset.bound === "true") {
    return;
  }

  container.dataset.bound = "true";

  container.addEventListener("mousedown", (event) => {
    const suggestionButton = event.target.closest("[data-action='select-suggestion']");

    if (suggestionButton) {
      event.preventDefault();
    }
  });

  container.addEventListener("click", async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      return;
    }

    const { action } = actionTarget.dataset;

    if (action === "add-token") {
      const panel = actionTarget.closest("[data-group-panel]");
      if (!panel) {
        return;
      }

      const input = panel.querySelector("[data-role='token-input']");
      if (!input) {
        return;
      }

      actions.addToken(panel.dataset.group, input.value);
      input.value = "";
      clearAutocomplete(panel);
      return;
    }

    if (action === "select-suggestion") {
      const panel = actionTarget.closest("[data-group-panel]");
      if (!panel) {
        return;
      }

      const input = panel.querySelector("[data-role='token-input']");
      if (!input) {
        return;
      }

      actions.addToken(panel.dataset.group, actionTarget.dataset.value);
      input.value = "";
      clearAutocomplete(panel);
      return;
    }

    if (action === "remove-token") {
      actions.removeToken(actionTarget.dataset.group, actionTarget.dataset.value);
      return;
    }

    if (action === "toggle-operator") {
      actions.setOperator(actionTarget.dataset.group, actionTarget.dataset.operator);
      return;
    }

    if (action === "add-stat-rule") {
      actions.addStatRule();
      return;
    }

    if (action === "remove-stat-rule") {
      actions.removeStatRule(actionTarget.dataset.ruleId);
      return;
    }

    if (action === "search") {
      await actions.search();
      return;
    }

    if (action === "clear") {
      actions.clearFilters();
    }
  });

  container.addEventListener("keydown", (event) => {
    if (event.target.dataset.role !== "token-input") {
      return;
    }

    const panel = event.target.closest("[data-group-panel]");

    if (!panel) {
      return;
    }

    const suggestions = getRenderedSuggestions(panel);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) {
        return;
      }

      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const currentIndex = Number(panel.dataset.activeSuggestionIndex || 0);
      const nextIndex =
        (currentIndex + direction + suggestions.length) % suggestions.length;

      panel.dataset.activeSuggestionIndex = String(nextIndex);
      updateActiveSuggestion(panel);
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const activeSuggestion = getActiveSuggestion(panel);
    const valueToAdd = activeSuggestion?.dataset.value || event.target.value;

    actions.addToken(panel.dataset.group, valueToAdd);
    event.target.value = "";
    clearAutocomplete(panel);
  });

  container.addEventListener("focusin", (event) => {
    const target = event.target;

    if (target.dataset.role !== "token-input") {
      return;
    }

    renderAutocomplete(target);
  });

  container.addEventListener("focusout", (event) => {
    const panel = event.target.closest("[data-group-panel]");

    if (!panel) {
      return;
    }

    window.setTimeout(() => {
      if (!panel.contains(document.activeElement)) {
        clearAutocomplete(panel);
      }
    }, 0);
  });

  container.addEventListener("input", (event) => {
    const target = event.target;

    if (target.dataset.role !== "token-input") {
      return;
    }

    renderAutocomplete(target);
  });

  container.addEventListener("change", (event) => {
    const target = event.target;
    const ruleId = target.dataset.ruleId;
    const field = target.dataset.field;

    if (!ruleId || !field) {
      return;
    }

    actions.updateStatRule(ruleId, { [field]: target.value });
  });
}

export function renderFilters(container, state) {
  const { query, ui, referenceData } = state;
  const isDisabled = ui.isSearching;
  const suggestions = {
    abilities: referenceData?.abilities || [],
    types: referenceData?.types || [],
    moves: referenceData?.moves || [],
  };

  container.innerHTML = `
    <div class="filters-shell">
      ${renderTokenGroup("abilities", query, isDisabled)}
      ${renderTokenGroup("types", query, isDisabled)}
      ${renderTokenGroup("moves", query, isDisabled)}
      ${renderStatsGroup(query, isDisabled)}

      <section class="filter-group">
        <div class="group-head">
          <div>
            <h3>Actions</h3>
            <p>Search runs only when you click the button, matching the planned product behavior.</p>
          </div>
        </div>

        <div class="button-row">
          <button class="primary-button" type="button" data-action="search" ${
            isDisabled ? "disabled" : ""
          }>
            ${isDisabled ? "Building..." : "Search"}
          </button>
          <button class="secondary-button" type="button" data-action="clear" ${
            isDisabled ? "disabled" : ""
          }>
            Clear filters
          </button>
        </div>
      </section>

      ${renderSuggestionSources(suggestions)}
    </div>
  `;
}

function renderTokenGroup(group, query, isDisabled) {
  const values = query[group];
  const operator = query.operators[group];

  return `
    <section class="filter-group" data-group-panel data-group="${group}" data-active-suggestion-index="0">
      <div class="group-head">
        <div>
          <h3>${groupLabels[group]}</h3>
          <p>${groupDescriptions[group]}</p>
        </div>
        ${renderOperatorToggle(group, operator, isDisabled)}
      </div>

      <div class="group-input-row">
        <div class="token-input-shell">
          <label class="visually-hidden" for="${group}-input">${groupLabels[group]}</label>
          <input
            id="${group}-input"
            class="token-input"
            type="text"
            placeholder="${groupPlaceholders[group]}"
            autocomplete="off"
            data-role="token-input"
            data-suggestions-id="${group}-suggestions"
            ${isDisabled ? "disabled" : ""}
          />
          <div class="autocomplete-panel" data-role="autocomplete-panel"></div>
        </div>
        <button class="ghost-button" type="button" data-action="add-token" ${
          isDisabled ? "disabled" : ""
        }>
          Add
        </button>
      </div>

      ${
        values.length > 0
          ? `<div class="chips-row">${values
              .map((value) => renderChip(group, value, isDisabled))
              .join("")}</div>`
          : `<div class="subtle-empty">No ${groupLabels[group].toLowerCase()} added yet.</div>`
      }
    </section>
  `;
}

function renderOperatorToggle(group, operator, isDisabled) {
  return `
    <div class="operator-toggle" role="group" aria-label="${groupLabels[group]} operator">
      ${["and", "or"]
        .map(
          (option) => `
            <button
              class="operator-button ${operator === option ? "is-active" : ""}"
              type="button"
              data-action="toggle-operator"
              data-group="${group}"
              data-operator="${option}"
              ${isDisabled ? "disabled" : ""}
            >
              ${option.toUpperCase()}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderChip(group, value, isDisabled) {
  return `
    <span class="chip">
      ${escapeHtml(humanizeKebabCase(value))}
      <button
        type="button"
        aria-label="Remove ${escapeHtml(value)}"
        data-action="remove-token"
        data-group="${group}"
        data-value="${escapeHtml(value)}"
        ${isDisabled ? "disabled" : ""}
      >
        x
      </button>
    </span>
  `;
}

function renderStatsGroup(query, isDisabled) {
  return `
    <section class="filter-group">
      <div class="group-head">
        <div>
          <h3>Base Stats</h3>
          <p>Add numeric rules like speed &gt;= 60, then decide whether they combine with AND or OR.</p>
        </div>
        ${renderOperatorToggle("stats", query.operators.stats, isDisabled)}
      </div>

      <div class="stats-stack">
        ${
          query.stats.length > 0
            ? query.stats.map((rule) => renderStatRule(rule, isDisabled)).join("")
            : `<div class="subtle-empty">No stat rules added yet.</div>`
        }
      </div>

      <div class="group-input-row">
        <button class="ghost-button" type="button" data-action="add-stat-rule" ${
          isDisabled ? "disabled" : ""
        }>
          Add stat rule
        </button>
      </div>
    </section>
  `;
}

function renderStatRule(rule, isDisabled) {
  return `
    <div class="stat-rule">
      <label class="visually-hidden" for="stat-${rule.id}">Stat</label>
      <select
        id="stat-${rule.id}"
        class="field-select"
        data-field="stat"
        data-rule-id="${rule.id}"
        ${isDisabled ? "disabled" : ""}
      >
        ${STAT_OPTIONS.map(
          (option) => `
            <option value="${option.value}" ${rule.stat === option.value ? "selected" : ""}>
              ${option.label}
            </option>
          `
        ).join("")}
      </select>

      <label class="visually-hidden" for="operator-${rule.id}">Operator</label>
      <select
        id="operator-${rule.id}"
        class="field-select operator-select"
        data-field="operator"
        data-rule-id="${rule.id}"
        ${isDisabled ? "disabled" : ""}
      >
        ${COMPARISON_OPERATORS.map(
          (operator) => `
            <option value="${operator}" ${rule.operator === operator ? "selected" : ""}>
              ${operator}
            </option>
          `
        ).join("")}
      </select>

      <label class="visually-hidden" for="value-${rule.id}">
        ${formatStatLabel(rule.stat)} value
      </label>
      <input
        id="value-${rule.id}"
        class="field-input"
        type="number"
        min="0"
        max="255"
        step="1"
        placeholder="Value"
        value="${escapeHtml(String(rule.value))}"
        data-field="value"
        data-rule-id="${rule.id}"
        ${isDisabled ? "disabled" : ""}
      />

      <button
        class="ghost-button"
        type="button"
        data-action="remove-stat-rule"
        data-rule-id="${rule.id}"
        ${isDisabled ? "disabled" : ""}
      >
        Remove
      </button>
    </div>
  `;
}

function renderSuggestionSources(suggestions) {
  return Object.entries(suggestions)
    .map(
      ([group, values]) => `
        <datalist id="${group}-suggestions">
          ${values
            .map((suggestion) => `<option value="${escapeHtml(suggestion)}"></option>`)
            .join("")}
        </datalist>
      `
    )
    .join("");
}

function renderAutocomplete(input) {
  const panel = input.closest("[data-group-panel]");

  if (!panel) {
    return;
  }

  const autocompletePanel = panel.querySelector("[data-role='autocomplete-panel']");

  if (!autocompletePanel) {
    return;
  }

  const suggestions = getClosestSuggestions(input);

  if (!suggestions.length) {
    clearAutocomplete(panel);
    return;
  }

  panel.dataset.activeSuggestionIndex = "0";
  autocompletePanel.innerHTML = suggestions
    .map(
      (suggestion, index) => `
        <button
          class="autocomplete-option ${index === 0 ? "is-active" : ""}"
          type="button"
          data-action="select-suggestion"
          data-value="${escapeHtml(suggestion)}"
        >
          ${renderSuggestionLabel(suggestion, input.value)}
        </button>
      `
    )
    .join("");
}

function clearAutocomplete(panel) {
  const autocompletePanel = panel.querySelector("[data-role='autocomplete-panel']");

  if (!autocompletePanel) {
    return;
  }

  autocompletePanel.innerHTML = "";
  panel.dataset.activeSuggestionIndex = "0";
}

function getClosestSuggestions(input) {
  const query = String(input.value || "").trim().toLowerCase();

  if (!query) {
    return [];
  }

  const sourceList = input.dataset.suggestionsId
    ? document.getElementById(input.dataset.suggestionsId)
    : null;

  if (!sourceList) {
    return [];
  }

  return [...sourceList.options]
    .map((option) => option.value)
    .filter((value) => value.toLowerCase().includes(query))
    .sort((left, right) => compareSuggestions(left, right, query))
    .slice(0, MAX_SUGGESTIONS);
}

function compareSuggestions(left, right, query) {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();
  const leftStarts = normalizedLeft.startsWith(query) ? 0 : 1;
  const rightStarts = normalizedRight.startsWith(query) ? 0 : 1;

  if (leftStarts !== rightStarts) {
    return leftStarts - rightStarts;
  }

  const leftIndex = normalizedLeft.indexOf(query);
  const rightIndex = normalizedRight.indexOf(query);

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  if (left.length !== right.length) {
    return left.length - right.length;
  }

  return left.localeCompare(right);
}

function renderSuggestionLabel(suggestion, query) {
  const normalizedSuggestion = suggestion.toLowerCase();
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const matchIndex = normalizedSuggestion.indexOf(normalizedQuery);

  if (!normalizedQuery || matchIndex === -1) {
    return escapeHtml(suggestion);
  }

  const start = suggestion.slice(0, matchIndex);
  const match = suggestion.slice(matchIndex, matchIndex + normalizedQuery.length);
  const end = suggestion.slice(matchIndex + normalizedQuery.length);

  return `${escapeHtml(start)}<strong>${escapeHtml(match)}</strong>${escapeHtml(end)}`;
}

function getRenderedSuggestions(panel) {
  return [...panel.querySelectorAll("[data-action='select-suggestion']")];
}

function getActiveSuggestion(panel) {
  return panel.querySelector(".autocomplete-option.is-active");
}

function updateActiveSuggestion(panel) {
  const activeIndex = Number(panel.dataset.activeSuggestionIndex || 0);
  const suggestions = getRenderedSuggestions(panel);

  suggestions.forEach((suggestion, index) => {
    suggestion.classList.toggle("is-active", index === activeIndex);
  });
}

