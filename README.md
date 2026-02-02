# LinkedIn Job Filter Extension

A Chrome extension to filter and sort LinkedIn job listings using TypeScript and modern build tools.

## Features

- **Sort jobs by**: Most Recent, Viewed First, Viewed Last, or Default order
- **Visual indicators**:
  - Orange border around "Viewed" jobs
  - 10% opacity (dimmed) for "Applied" jobs
  - Option to hide "Applied" jobs completely
- **Floating control panel** for quick access on the page
- **Popup interface** with detailed stats
- **Settings persistence** across sessions
- **TypeScript** for type safety and better developer experience
- **Vite** for fast development and optimized builds

## Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool for fast development and production builds
- **Chrome Extensions Manifest V3** - Latest extension API
- **ESLint** - Code linting and quality

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

Watch mode for development (rebuilds on file changes):

```bash
npm run dev
```

### Build

Build for production:

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Project Structure

```
linkedin-extension/
├── src/                    # Source TypeScript files
│   ├── types.ts           # TypeScript type definitions
│   ├── content.ts         # Content script (runs on LinkedIn pages)
│   ├── popup.ts           # Popup script logic
│   └── styles.css         # Styles for visual indicators
├── dist/                   # Built extension files (load this in Chrome)
│   ├── manifest.json
│   ├── content.js
│   ├── popup.js
│   ├── popup.html
│   └── styles.css
├── icons/                  # Extension icons
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Installation in Chrome

### Development Mode

1. Run `npm run build` to create the `dist` folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `dist` folder
6. The extension will appear in your extensions list

### Hot Reload During Development

1. Run `npm run dev` - this watches for file changes and rebuilds automatically
2. Load the `dist` folder in Chrome extensions
3. When you change TypeScript files, Vite rebuilds automatically
4. You may need to reload the extension in Chrome (click the refresh icon on the extension card)

## Usage

### On LinkedIn Jobs Page:

1. Navigate to any LinkedIn jobs search page (e.g., `linkedin.com/jobs/search`)
2. A floating ⚙️ button appears in the top-right corner
3. Click it to open the filter controls

### Using the Controls:

**Sort By**:
- Default: LinkedIn's original order
- Most Recent: Jobs with newest `<time>` tags first
- Viewed First: Viewed jobs appear at top
- Viewed Last: Viewed jobs appear at bottom

**Display Options**:
- Hide Applied: Completely removes applied jobs from view
- Dim Applied: Makes applied jobs 10% opaque
- Highlight Viewed: Shows orange border around viewed jobs

### Using the Popup:

1. Click the extension icon in Chrome toolbar
2. See job statistics (Total, Viewed, Applied counts)
3. Adjust settings and click "Apply Filters"

## How It Works

The extension:
1. Detects job cards using LinkedIn's `data-occludable-job-id` attribute
2. Analyzes the footer to identify "Viewed", "Applied", or time-based status
3. Applies CSS classes for visual feedback
4. Reorders DOM elements when sorting (no API calls)
5. Uses MutationObserver to handle infinite scroll loading

## Browser Compatibility

- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)
- Opera 74+ (Chromium-based)
- Brave 1.19+ (Chromium-based)

**Note**: Firefox support requires changes to use Manifest V2 or the `browser.*` API namespace.

## Scripts

- `npm run dev` - Development mode with file watching
- `npm run build` - Production build
- `npm run lint` - Run ESLint

## Type Safety

The project uses TypeScript with:
- Strict type checking enabled
- Chrome extension type definitions (@types/chrome)
- Interface definitions for all data structures
- Proper typing for Chrome APIs

## Troubleshooting

**Extension not working?**
1. Ensure you're on a LinkedIn jobs page (URL contains `/jobs`)
2. Make sure you ran `npm run build` and loaded the `dist` folder
3. Check browser console for errors (F12 → Console)

**Build errors?**
1. Run `npm install` to ensure all dependencies are installed
2. Check that you're using Node.js 18+

**Jobs not filtering?**
1. Wait for the page to fully load
2. Scroll down to load more jobs if using infinite scroll
3. Click "Apply Filters" button again

## Development Tips

- The `src/` folder contains TypeScript source files
- The `dist/` folder contains the compiled extension (load this in Chrome)
- Use `npm run dev` during development for automatic rebuilds
- Type definitions are in `src/types.ts`
- Content script runs in the context of LinkedIn pages
- Popup script runs in the extension popup

## License

MIT License - Feel free to modify and distribute.
