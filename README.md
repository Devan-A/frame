# Concept Board Parser - FigJam Plugin

A FigJam plugin that reads a structured FigJam board, parses its hierarchical content using a strict naming convention, and presents the extracted data in a clean, interactive UI panel.

## Features

- **Recursive Board Parsing**: Traverses nested sections to extract concepts, participants, and features
- **Score Visualization**: Color-coded badges for participant scores (1-4 scale)
- **Average Score Calculation**: Automatic computation of average scores per concept
- **Canvas Highlighting**: Click any concept or participant to highlight it on the canvas
- **Export Options**: Download parsed data as JSON or CSV
- **Collapsible Sections**: Expandable concept cards for better organization

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

## License

MIT
# frame
