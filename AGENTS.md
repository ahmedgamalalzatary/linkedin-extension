# Agent Guidelines for LinkedIn Job Filter Extension

## Build Commands

```bash
# Development (watch mode)
npm run dev

# Production build
npm run build

# Linting
npm run lint
```

## Project Structure

- `src/` - TypeScript source files
  - `content.ts` - Content script (runs on LinkedIn pages)
  - `popup.ts` - Popup script logic
  - `types.ts` - TypeScript type definitions
  - `styles.css` - Styles for job cards and floating controls
- `public/` - Static assets (manifest.json, popup.html, popup.css, icons)
- `dist/` - Built extension files (load this in Chrome)

## Code Style Guidelines

### TypeScript
- **Target**: ES2020 with strict mode enabled
- Use `import type { ... }` for type-only imports
- Explicit return types on public methods
- Use `const` assertions for configuration objects
- Enable `noUncheckedIndexedAccess` - handle potential undefined values

### Naming Conventions
- Classes: PascalCase (e.g., `JobFilterExtension`)
- Methods/Functions: camelCase (e.g., `processJobs`)
- Private methods: prefix with `private` keyword
- Constants: UPPER_SNAKE_CASE for true constants
- Types/Interfaces: PascalCase with descriptive names

### Error Handling
- Check for `chrome.runtime.lastError` after Chrome API calls
- Use optional chaining (`?.`) for potentially null DOM elements
- Provide fallback values with nullish coalescing (`??`)
- Log errors to console with `[LinkedIn Job Filter]` prefix

### DOM Manipulation
- Store selectors in a CONFIG object with `as const`
- Use `querySelector` with specific attribute selectors
- Clear old styles before applying new ones (handle status changes)
- Use `MutationObserver` for dynamic content

### Chrome Extension APIs
- Use `chrome.storage.local` for settings persistence
- Use `chrome.tabs.query` + `chrome.tabs.sendMessage` for tab communication
- Message types: `applySettings`, `getStats`, `stats`

### CSS Classes
- Prefix all extension classes with `linkedin-job-filter-`
- Use `!important` to override LinkedIn's styles
- Status classes: `linkedin-job-filter-viewed`, `linkedin-job-filter-applied`

### Type Definitions
All types are in `src/types.ts`:
- `JobStatus`: 'normal' | 'viewed' | 'applied'
- `ExtensionSettings`: sortBy, appliedAction, highlightViewed
- `MessageRequest`/`MessageResponse` for Chrome messaging

## Testing Notes

No test framework is currently configured. To add tests, consider:
- Vitest for unit testing
- Playwright or Puppeteer for E2E testing with Chrome extension loading

## Extension Loading

1. Build with `npm run build`
2. Open Chrome → `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked"
5. Select the `dist/` folder

## Important Implementation Details

- Content script runs at `document_idle` on `linkedin.com/jobs/*`
- Job cards are identified by `[data-occludable-job-id]` attribute
- Sorting works by re-ordering DOM elements (not API calls)
- Original order is captured and restored when sortBy is 'default'
- Time parsing handles relative times like "2 hours ago"
