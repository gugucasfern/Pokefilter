# AI Context: DexQuery (PokeFilter)

## 1. Stack
| Layer | Technology |
| :--- | :--- |
| **Frontend** | Vanilla JS (ES Modules), HTML5, CSS3 |
| **API** | PokeAPI |
| **Storage** | IndexedDB (Persistent), LocalStorage (Drafts), Memory (Session) |
| **Runtime** | Node.js (Static Server) |

## 2. Project Structure
```text
├── index.html          # Entry point
├── server.mjs          # Static file server
├── src/
│   ├── main.js         # App orchestrator & event binding
│   ├── config.js       # Constants & API config
│   ├── api/            # PokeAPI client (pokeapi.js)
│   ├── cache/          # Cache logic (cache.js, indexeddb.js)
│   ├── search/         # Query model & engine (query-engine.js, query-model.js, set-logic.js)
│   ├── state/           # State management (store.js)
│   ├── ui/             # UI components (filters.js, results.js, status.js)
│   └── utils/          # Helpers (normalize.js)
├── styles/             # CSS (main.css)
└── tests/              # Unit tests (query-engine.test.mjs)
```

## 3. Core Logic & Flow
### Search Pipeline
`UI (filters.js)` $\rightarrow$ `Store (store.js)` $\rightarrow$ `Query Engine (query-engine.js)` $\rightarrow$ `API (pokeapi.js)` $\rightarrow$ `UI (results.js)`

### Search Execution Rules
1. **Set Reduction**: 
   - Fetch lists for `abilities`, `types`, `moves`.
   - Apply `AND`/`OR` logic using `set-logic.js` to minimize candidate pool.
2. **Hydration**: 
   - Fetch full details only for the final reduced candidate list.
3. **Stat Filtering**: 
   - Apply numerical rules (`>=`, etc.) on hydrated data.
4. **Caching**: 
   - `API Request` $\rightarrow$ `Memory Cache` $\rightarrow$ `IndexedDB` $\rightarrow$ `Network`.

### State Management
- **Store**: Simple `getState`/`setState`/`subscribe` pattern.
- **Persistence**: Current query draft is saved to `localStorage` on every change.

## 4. Pending / Next Steps
- [ ] **Phase 6 (Polishing)**: Visual refinement, responsiveness, and improved error messages.
- [ ] **Phase 7 (Validation)**: Full test suite execution and manual scenario validation.
- [ ] **Optimization**: Refine concurrency limits for batch hydration.