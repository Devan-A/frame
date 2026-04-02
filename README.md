# Concept Board Parser - FigJam Plugin

A FigJam plugin that reads a structured FigJam board, parses its hierarchical content using a strict naming convention, analyzes the data, and draws results back to designated sections on the board.

## Features

- **Recursive Board Parsing**: Traverses nested sections to extract concepts, participants, and features
- **Score Visualization**: Color-coded badges for participant scores (1-4 scale)
- **Average Score Calculation**: Automatic computation of average scores per concept
- **Canvas Highlighting**: Click any concept or participant to highlight it on the canvas
- **Export Options**: Download parsed data as JSON or CSV
- **Collapsible Sections**: Expandable concept cards for better organization
- **Analyze & Draw**: Sends data to API and draws results back to the board (mock data for now)

## Board Naming Convention

The plugin expects a specific naming structure:

```
Board
└── concept-{n}                        (e.g. concept-1, concept-2)
    └── participant-{n}                (e.g. participant-1, participant-2)
        ├── concept-score              (sticky/text with value 1–4)
        └── feature-{n}                (e.g. feature-1, feature-2)
            ├── feature-{n}-title      (text node)
            └── feature-{n}-description (text node)
```

### Naming Rules

- All names are **case-insensitive** (e.g., `Concept-1` works the same as `concept-1`)
- Use **hyphens**, not spaces or underscores
- `{n}` is a **positive integer starting from 1**
- Sections can be FigJam **frames**, **sections**, or **groups**
- Text content is extracted from `TEXT`, `STICKY`, or `SHAPE_WITH_TEXT` nodes

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Build the plugin:

```bash
npm run build
```

4. In FigJam:
   - Go to **Plugins** → **Development** → **Import plugin from manifest...**
   - Select the `manifest.json` file from this directory

## Development

Run the watch mode for development:

```bash
npm run dev
```

This will rebuild automatically when you make changes.

## Usage

1. Open a FigJam board with the naming convention described above
2. Run the plugin from **Plugins** → **Concept Board Parser**
3. Click **Parse Board** to scan and extract data
4. Click on any concept or participant to highlight it on the canvas
5. Use the **JSON** or **CSV** buttons to export the data

## Project Structure

```
├── manifest.json           # Figma plugin manifest
├── package.json            # Dependencies and scripts
├── webpack.config.js       # Build configuration
├── src/
│   ├── plugin/
│   │   └── controller.ts   # Plugin sandbox code (Figma API access)
│   ├── ui/
│   │   ├── index.html      # UI entry HTML
│   │   ├── main.tsx        # React entry point
│   │   ├── App.tsx         # Main application component
│   │   ├── styles.css      # Tailwind CSS styles
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   └── utils/          # Utility functions
│   └── types/
│       └── index.ts        # TypeScript interfaces
```

## Score Color Coding

| Score | Color  |
|-------|--------|
| 1     | Red    |
| 2     | Orange |
| 3     | Yellow |
| 4     | Green  |
| N/A   | Gray   |

## Analyze & Draw Feature

The "Analyze & Draw" button sends the parsed board data to an API (currently uses mock data) and draws the results to these sections on your board:

### Required Output Sections

Create these sections on your FigJam board for the analysis results:

| Section Name | Content |
|-------------|---------|
| `highest-scoring-concept-description` | Title and description of the winning concept |
| `table-of-concept-scores` | Ranked table with: Rank, Name, Z-Score, Disagreement, Consensus Weight, Final Score |
| `titles-for-needs` | Mapping of needs to theme titles |
| `all-features` | List of features with needs and rationale |
| `all-features-scoring` | Grid of participants with feature names, descriptions, and criticality |

### API Response Structure (Mock Data)

```typescript
interface AnalysisResponse {
  prioritized_concept_list: ConceptScore[];
  highest_scoring_concept: Concept;
  insights: Insight[];
  features_and_themes: FeatureTheme[];
}
```

When the real API is ready, update `src/plugin/controller.ts` to replace the mock data call with actual API integration.

## License

MIT
# frame
