import { countActiveFilters, isFilledStatRule } from "../search/query-model.js";
import { buildQueryPreview } from "../search/query-engine.js";
import { escapeHtml } from "../utils/normalize.js";

export function renderStatus(container, state) {
  const { query, status } = state;
  const preview = buildQueryPreview(query);
  const filledStatCount = query.stats.filter(isFilledStatRule).length;

  container.innerHTML = `
    <section class="status-card">
      <div class="status-head">
        <div>
          <span class="panel-kicker">System status</span>
          <h3 class="status-title">${escapeHtml(status.title)}</h3>
        </div>
        <span class="status-pill" data-tone="${escapeHtml(status.tone)}">
          ${escapeHtml(status.tone)}
        </span>
      </div>

      <p>${escapeHtml(status.message)}</p>

      <div class="metrics-grid">
        <div class="metric">
          <span class="metric-label">Active filters</span>
          <span class="metric-value">${countActiveFilters(query)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Abilities</span>
          <span class="metric-value">${query.abilities.length}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Types</span>
          <span class="metric-value">${query.types.length}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Moves + stats</span>
          <span class="metric-value">${query.moves.length + filledStatCount}</span>
        </div>
      </div>

      <div class="query-preview">
        <span class="panel-kicker">Draft expression</span>
        <h3>Current query</h3>
        <p>${escapeHtml(preview || "No active filters yet.")}</p>
      </div>
    </section>
  `;
}
