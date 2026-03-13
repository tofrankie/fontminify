/** Supported font output formats. */
export type FontFormat = 'ttf' | 'woff' | 'woff2'

/** Configuration for collecting characters from project source files. */
export interface CollectConfig {
  /** Glob patterns for files to scan. Supports multiple patterns, e.g. all ts/tsx/vue files under `src`. */
  include: string[]
  /** Glob patterns for files to exclude from the scan, e.g. node_modules and dist directories. */
  exclude?: string[]
  /**
   * Unicode regex string (without `/…/` delimiters) used to extract characters.
   * Defaults to `\\p{Script=Han}` (Chinese characters).
   * Example: `"\\p{Script=Han}|[a-zA-Z0-9]"`
   */
  characterPattern?: string
}

/** Configuration for font source/destination directories and output formats. */
export interface FontsConfig {
  /** Directory containing source `.ttf` files. All `.ttf` files in this directory are read (non-recursive). */
  src: string
  /** Output directory for subsetted font files. */
  dest: string
  /** List of output formats to generate, e.g. `["woff2", "woff"]`. */
  formats: FontFormat[]
}

/** Configuration for glyph subsetting behavior. */
export interface GlyphConfig {
  /**
   * Whether to retain TTF hinting information (fpgm / prep / cvt tables).
   * Keeping hinting can improve rendering at small font sizes but slightly increases file size.
   * Defaults to `false`.
   */
  hinting?: boolean
}

/** Configuration for the statistics report output. */
export interface ReportConfig {
  /** Whether to output the report as JSON to stdout (useful for CI pipelines). Defaults to `false`. */
  json?: boolean
}

/**
 * User-facing configuration structure for `fontminify.config.js`. All fields are optional.
 * It is recommended to wrap with `defineConfig()` to get full TypeScript type hints.
 */
export interface FontminifyConfig {
  /**
   * Path(s) to preset character files. Accepts a single path, an array of paths, or glob patterns.
   * Preset files declare characters that must always be included (e.g. common characters, product-specific
   * vocabulary). They are merged with scanned project characters before subsetting.
   */
  presetCharsFile?: string | string[]
  /**
   * Character collection configuration. All sub-fields are optional — unspecified fields
   * fall back to config-file values, then to built-in defaults.
   */
  collect?: Partial<CollectConfig>
  /** Font source/destination directories and output format configuration. */
  fonts?: Partial<FontsConfig>
  /** Glyph subsetting configuration. */
  glyph?: GlyphConfig
  /** Report output configuration. */
  report?: ReportConfig
}

/**
 * Fully resolved configuration after merging all priority layers (CLI args > config file > defaults).
 * All fields are guaranteed to be defined. Commands consume only this type, never the raw config.
 */
export interface ResolvedFontminifyConfig {
  /** Preset character file paths, normalized to an array. */
  presetCharsFile: string[]
  /** Character collection configuration with all fields required. */
  collect: Required<CollectConfig>
  /** Font directory and format configuration with all fields required. */
  fonts: FontsConfig
  /** Glyph subsetting configuration with all fields required. */
  glyph: Required<GlyphConfig>
  /** Report output configuration with all fields required. */
  report: Required<ReportConfig>
}

/** Subsetting result for a single font file in a single output format. */
export interface FontSubsetResult {
  /** Source font filename without extension, e.g. `"SourceHanSansCN-Regular"`. */
  fontName: string
  /** Output format, e.g. `"woff2"`. */
  format: string
  /** Source font file size in bytes. */
  originalSize: number
  /** Subsetted font file size in bytes. */
  subsetSize: number
  /** Bytes saved (`originalSize - subsetSize`). */
  savedBytes: number
  /** Percentage of bytes saved (0–100). */
  savedPercent: number
  /** Absolute path to the output file. */
  outputPath: string
}

/** Full statistics report produced after a `fontminify build` run. */
export interface BuildReport {
  /** ISO 8601 timestamp of when the report was generated. */
  timestamp: string
  /** Total time the build pipeline took, in milliseconds. */
  durationMs: number
  /** Whether this report was produced by a `--dry-run` invocation. */
  dryRun: boolean
  /** Number of unique characters contributed by preset files. */
  presetCharCount: number
  /** Number of unique characters extracted by scanning project files. */
  scannedCharCount: number
  /** Total unique characters after merging preset and scanned sets (used for subsetting). */
  totalCharCount: number
  /** Subsetting results for all fonts and formats, sorted by bytes saved in descending order. */
  results: FontSubsetResult[]
  /** Combined size of all source fonts in bytes (a source font is counted once per output format). */
  totalOriginalSize: number
  /** Combined size of all output files in bytes. */
  totalSubsetSize: number
  /** Total bytes saved across all output files. */
  totalSavedBytes: number
  /** Overall percentage of bytes saved (0–100). */
  totalSavedPercent: number
}

/** Structured error shape carrying a machine-readable code. */
export interface FontminifyErrorLike extends Error {
  /**
   * Machine-readable error code:
   * - `USER_ERROR` — invalid user input (bad arguments, missing paths, etc.)
   * - `RUNTIME_ERROR` — runtime failure (subsetting error, I/O error, etc.)
   * - `EMPTY_CHARACTER_LIST` — the final merged character list is empty (no characters to include)
   */
  code: string
}
