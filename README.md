# @tofrankie/fontminify

[![npm version](https://img.shields.io/npm/v/@tofrankie/fontminify)](https://www.npmjs.com/package/@tofrankie/fontminify) [![node version](https://img.shields.io/node/v/@tofrankie/fontminify)](https://nodejs.org) [![npm package license](https://img.shields.io/npm/l/@tofrankie/fontminify)](https://github.com/tofrankie/fontminify/blob/main/LICENSE)

English | [中文](./README.zh-CN.md)

**fontminify** is a font subsetting tool: it builds subset fonts from TTF using the characters you provide, keeping only those glyphs to reduce file size.

## Features

- **Which characters are kept?**
  - Automatically extracts characters used in your project (default: Chinese characters).
  - Built-in preset character lists (common characters, punctuation, ASCII, etc.) for quick export; you can edit exported files or build your own from scratch.

- **Subsetting and output**
  - Batch subsetting; multiple output formats (WOFF, WOFF2, etc.).

- **Usage**
  - CLI and Node API (for scripts); optional config file; full TypeScript types.

## Important

> [!IMPORTANT]
> Subsetting keeps only the requested characters and can greatly reduce font size. Characters not in the list will fall back to the default font — **you are responsible for the result**. Use `--chars-out` to export the list of characters (used for subsetting) for review.
>
> - The amount of savings depends on how many characters you keep
> - Missing characters may appear as missing glyphs depending on your environment

## Quick start

> **Node.js >= 20**

Global install:

```bash
$ npm install @tofrankie/fontminify -g
```

### Using the CLI

You can pass options directly without a config file. For example:

```bash
$ fontminify build \
  --font-src fonts/ \
  --font-dest dist/fonts/ \
  --formats woff,woff2 \
  --include "src/**/*.{json,js,jsx,ts,tsx,vue}"
```

### Project integration

For a web or Node.js project, install `@tofrankie/fontminify` as a dependency rather than globally.

Use `fontminify init` to generate a config file (see below):

```bash
# 1. Generate config file fontminify.config.js
$ npx fontminify init

# 2. Edit fontminify.config.js — set source font dir, output dir, and scan globs

# 3. Run subsetting (prefer defining this in package.json scripts)
$ npx fontminify build
```

Example:

```json
{
  "scripts": {
    "build": "vite build",
    "font:minify": "fontminify build"
  }
}
```

To run subsetting on every build:

```json
{
  "scripts": {
    "build": "fontminify build && vite build"
  }
}
```

> Whether to run subsetting on every build depends on your project needs.

### Node API

```ts
import { buildSubset, getResolvedConfig } from '@tofrankie/fontminify'

const config = await getResolvedConfig(undefined, {
  fonts: { src: 'fonts', dest: 'dist/fonts', formats: ['woff2'] },
})
const report = await buildSubset(config)
console.log(`Saved ${report.totalSavedBytes} bytes`)
```

## Font formats

Summary:

- **TTF (TrueType Font)** — Universal, good compatibility; larger files, not tuned for the web.
- **OTF (OpenType Font)** — Extension of TTF with more characters and advanced typography; usually larger. Features include ligatures (e.g. `fi`, `ff`), tabular figures, fractions (`1/2`), superscript/subscript (e.g. `H₂O`).
- **WOFF (Web Open Font Format)** — Designed for the web; compressed TTF/OTF, smaller and faster to load; lower compression than WOFF2. Supported since IE 9.
- **WOFF2 (Web Open Font Format 2.0)** — Successor to WOFF with Brotli; about 30% better compression. Not supported on IE 11.

Comparison:

| Format | Size   | Compression | Web-optimized | Compatibility | Recommended |
| ------ | ------ | ----------- | ------------- | ------------- | ----------- |
| TTF    | Large  | None        | ❌            | ⭐️⭐️⭐️⭐️⭐️    | ⭐️⭐️        |
| OTF    | Large  | None        | ❌            | ⭐️⭐️⭐️⭐️⭐️    | ⭐️⭐️        |
| WOFF   | Medium | Medium      | ✅            | ⭐️⭐️⭐️⭐️      | ⭐️⭐️⭐️      |
| WOFF2  | Small  | High        | ✅            | ⭐️⭐️⭐️⭐️      | ⭐️⭐️⭐️⭐️⭐️  |

> For reference only; choose as needed.

> This tool currently supports output formats: `ttf`, `woff`, `woff2`.

## Config file

Config file name: `fontminify.config.js` (`.mjs.cjs.ts` also supported). Place it in the project root or pass path via `--config`.

> Priority: **CLI args > config file > defaults.**

```js
import { defineConfig } from '@tofrankie/fontminify'

export default defineConfig({
  // Path(s) to preset character file(s). String or array.
  presetCharsFile: 'preset-chars.txt',

  // Scan scope and character extraction
  collect: {
    include: ['src/**/*.{ts,tsx,js,jsx,vue,svelte,html,md}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Unicode regex (default: Chinese characters)
    // characterPattern: '\\p{Script=Han}',
  },

  fonts: {
    src: 'fonts',
    dest: 'dist/fonts',
    formats: ['woff', 'woff2'],
  },

  glyph: {
    hinting: false,
  },

  report: {
    json: false,
  },
})
```

## Commands and options

- `fontminify build` — Full pipeline: read presets → scan project → merge/dedupe → batch subset → report
- `fontminify collect` — Collect and print the characters to include (no font output)
- `fontminify init` — Generate `fontminify.config.js` in the current directory
- `fontminify presets list` — List all built-in presets
- `fontminify presets generate` — Export a built-in preset to a file for editing

### `fontminify build`

Full pipeline: read presets → scan project → merge/dedupe → batch subset → report.

| Option                        | Description                                                          | Config key                 |
| ----------------------------- | -------------------------------------------------------------------- | -------------------------- |
| `-c, --config <path>`         | Config file path (default: `fontminify.config.js`)                   | —                          |
| `--preset <path...>`          | Preset character file(s)                                             | `presetCharsFile`          |
| `--include <glob...>`         | File glob(s) to scan                                                 | `collect.include`          |
| `--exclude <glob...>`         | Glob(s) to exclude                                                   | `collect.exclude`          |
| `--character-pattern <regex>` | Unicode regex for character extraction (default: `\p{Script=Han}`)   | `collect.characterPattern` |
| `--font-src <dir>`            | Source font directory (reads `.ttf` in this dir only, non-recursive) | `fonts.src`                |
| `--font-dest <dir>`           | Output font directory                                                | `fonts.dest`               |
| `--formats <list>`            | Output formats, comma-separated, e.g. `ttf`, `woff`, `woff2`         | `fonts.formats`            |
| `--dry-run`                   | Scan and estimate only, do not write font files                      | —                          |
| `--chars-out <path>`          | Write the final characters (used for subsetting) to a file           | —                          |
| `--silent`                    | Suppress progress (JSON report still printed if `--json` is set)     | —                          |
| `--json`                      | Output report as JSON to stdout                                      | `report.json`              |

### `fontminify init`

Generates `fontminify.config.js` in the current directory. Fails if the file already exists unless `--force` is used.

### `fontminify collect`

Collect and print the characters to include only; no subsetting. Useful for debugging.

```bash
# Default: print to stdout
$ fontminify collect

# Write to file
$ fontminify collect --out chars.txt

# JSON output
$ fontminify collect --json | jq .count
```

### `fontminify presets list`

List all built-in presets.

Current presets: Simplified Chinese, Traditional Chinese, Hong Kong common characters, Taiwan common characters, ASCII. PRs welcome for more preset character lists. 👋

| Preset name                             | Description                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `zh-CN-common-characters`               | [Modern Chinese common characters](./src/templates/presets/zh-CN-common-characters.txt) (2,500 chars)                           |
| `zh-CN-secondary-characters`            | [Modern Chinese secondary characters](./src/templates/presets/zh-CN-secondary-characters.txt) (1,000 chars)                     |
| `zh-CN-common-and-secondary-characters` | [Modern Chinese common + secondary characters](./src/templates/presets/zh-CN-common-and-secondary-characters.txt) (3,500 chars) |
| `zh-CN-punctuation-characters`          | [Chinese punctuation](./src/templates/presets/zh-CN-punctuation-characters.txt)                                                 |
| `zh-HK-common-characters`               | [Hong Kong common characters](./src/templates/presets/zh-HK-common-characters.txt) (4,762 chars)                                |
| `zh-TW-common-characters`               | [Taiwan common characters](./src/templates/presets/zh-TW-common-characters.txt) (4,808 chars)                                   |
| `ascii-characters`                      | [ASCII characters](./src/templates/presets/ascii-characters.txt)                                                                |

You can combine presets, e.g. common + secondary + punctuation + ASCII (choose as needed).

### `fontminify presets generate`

Export a built-in preset to a file. Edit the file if the preset does not match your needs.

```bash
# Interactive: select preset and output path
$ fontminify presets generate

# Specify output path
$ fontminify presets generate --out preset-chars.txt

# Specify preset and output path
$ fontminify presets generate zh-CN-common-and-secondary-characters --out preset-chars.txt
```

## Node API

### Methods

| Method                                       | Description                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `getResolvedConfig(configPath?, overrides?)` | Resolve full config from file (optional) and overrides; returns `Promise<ResolvedFontminifyConfig>`.                     |
| `buildSubset(config, options?)`              | Full pipeline: read presets → scan → merge → subset → return report. Use `options.dryRun: true` to skip writing files.   |
| `collectProjectChars(config)`                | Collect characters only: read presets + scan project; returns `{ presetChars, scannedChars, finalText }`. No subsetting. |
| `defineConfig(config)`                       | Helper for config objects with TypeScript inference.                                                                     |
| `validateResolvedConfig(config)`             | Validate resolved config; throws on invalid config.                                                                      |

### Types and errors

- **Config:** `FontminifyConfig`, `ResolvedFontminifyConfig`, `CollectConfig`, `FontsConfig`, `GlyphConfig`, `ReportConfig`
- **Results:** `BuildReport`, `FontSubsetResult`, `FontFormat`
- **Errors:** `FontminifyError` (with `code`: `USER_ERROR` / `RUNTIME_ERROR` / `EMPTY_CHARACTER_LIST`). Use `ERROR_CODES` for comparison.

### Example

```ts
import { buildSubset, getResolvedConfig } from '@tofrankie/fontminify'

const config = await getResolvedConfig(undefined, {
  fonts: { src: 'fonts', dest: 'dist/fonts', formats: ['woff2'] },
})
const report = await buildSubset(config)
console.log(`Saved ${report.totalSavedBytes} bytes`)
```

### CI and exit codes

```bash
$ fontminify build --json > font-report.json
```

| Exit code | Meaning                                                             |
| --------- | ------------------------------------------------------------------- |
| 0         | Success                                                             |
| 1         | User error (bad args, missing paths, no characters collected, etc.) |
| 2         | Runtime error (subsetting or I/O failure)                           |

## License

MIT
