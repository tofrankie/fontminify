# @tofrankie/fontminify

[![npm version](https://img.shields.io/npm/v/@tofrankie/fontminify)](https://www.npmjs.com/package/@tofrankie/fontminify) [![node version](https://img.shields.io/node/v/@tofrankie/fontminify)](https://nodejs.org) [![npm package license](https://img.shields.io/npm/l/@tofrankie/fontminify)](https://github.com/tofrankie/fontminify/blob/main/LICENSE) [![npm last update](https://img.shields.io/npm/last-update/@tofrankie/fontminify)](https://www.npmjs.com/package/@tofrankie/fontminify)

[English](./README.md) | 中文

**fontminify** 是一个字体子集化工具：根据你提供的字符从 TTF 生成子集字体，仅保留这些字形，可显著减小文件体积。

## 特性概览

- **子集保留哪些字符？**
  - 自动提取项目用字，默认提取汉字。
  - 内置预设字库（常用字、标点、ASCII 等），支持快速导出；不满足可自行增删，也可完全自建字库。
- **子集化与输出**
  - 支持批量子集化；多格式输出（WOFF、WOFF2 等）
- **使用方式**
  - CLI 与 Node API（脚本）两种使用方式，可配合配置文件；完整 TypeScript 类型

## 写在前面

> [!IMPORTANT]
> 子集化只保留所需字符，可大幅减小字体体积。未覆盖的字符会回退到默认字体显示，**后果自行承担**；可用 `--chars-out` 导出最终要保留的字符列表做审查。
>
> - 优化幅度具体取决于保留的字符数量
> - 未覆盖的字符不排除出现缺字情况，取决于你的应用环境

## 快速上手

> **Node.js >= 20**

全局安装：

```bash
$ npm install @tofrankie/fontminify -g
```

### 使用命令行

可以直接传参，无需配置文件。比如：

```bash
$ fontminify build \
  --font-src fonts/ \
  --font-dest dist/fonts/ \
  --formats woff,woff2 \
  --include "src/**/*.{json,js,jsx,ts,tsx,vue}"
```

### 与项目集成

以 Web 或 Node.js 项目为例。对于项目来说，建议将 `@tofrankie/fontminify` 作为项目依赖，而不是全局安装。

可以借助 `fontminify init` 快速生成配置文件（详见下文）：

```bash
# 1. 生成配置文件 fontminify.config.js
$ npx fontminify init

# 2. 打开 fontminify.config.js，填好「源字体目录」「输出目录」「扫描范围」

# 3. 执行子集化（建议在 package.json 的 scripts 中定义，而不是每次执行此命令）
$ npx fontminify build
```

例如：

```json
{
  "scripts": {
    "build": "vite build",
    "font:minify": "fontminify build"
  }
}
```

若每次构建都要进行子集化处理，可以考虑这样：

```json
{
  "scripts": {
    "build": "fontminify build && vite build"
  }
}
```

> 至于是否每次构建都要进行子集化处理，取决于你的项目需求。

### Node API

```ts
import { buildSubset, getResolvedConfig } from '@tofrankie/fontminify'

const config = await getResolvedConfig(undefined, {
  fonts: { src: 'fonts', dest: 'dist/fonts', formats: ['woff2'] },
})
const report = await buildSubset(config)
console.log(`Saved ${report.totalSavedBytes} bytes`)
```

## 字体格式

优劣：

- **TTF (TrueType Font)**：通用格式，兼容性好；文件较大，未针对 Web 优化。
- **OTF (OpenType Font)**：TTF 的扩展，支持更多字符和高级排版；文件通常更大。高级功能包括连字（如 `fi`、`ff`）、等宽数字、分数（如 `1/2`）、上标下标（如 `H₂O`）等。
- **WOFF (Web Open Font Format)**：专为 Web 设计，是 TTF/OTF 的压缩版本，文件更小、加载更快；压缩率不如 WOFF2。IE 9+ 起支持。
- **WOFF2 (Web Open Font Format 2.0)**：WOFF 的升级版，采用 Brotli 压缩，压缩率比 WOFF 高约 30%，文件更小。不支持 IE 11。

对比：

| 格式  | 文件大小 | 压缩率 | Web 优化 | 兼容性     | 推荐度     |
| ----- | -------- | ------ | -------- | ---------- | ---------- |
| TTF   | 大       | 无     | ❌       | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️       |
| OTF   | 大       | 无     | ❌       | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️       |
| WOFF  | 中       | 中     | ✅       | ⭐️⭐️⭐️⭐️   | ⭐️⭐️⭐️     |
| WOFF2 | 小       | 高     | ✅       | ⭐️⭐️⭐️⭐️   | ⭐️⭐️⭐️⭐️⭐️ |

> 仅供参考，按需选择！

> 当前工具输出格式仅支持：`ttf`、`woff`、`woff2`。

## 配置文件

配置文件名为 `fontminify.config.js`（也支持 `.mjs/.cjs/.ts`）。通常放置在项目根目录下，或用 `--config` 指定路径。

> 优先级：CLI 参数 > 配置文件 > 默认值。

```js
import { defineConfig } from '@tofrankie/fontminify'

export default defineConfig({
  // 预置字库文件路径（多个可用数组形式）
  presetCharsFile: 'preset-chars.txt',

  // 扫描范围及字符提取规则
  collect: {
    // 要扫描的文件 glob（可多个）
    include: ['src/**/*.{ts,tsx,js,jsx,vue,svelte,html,md}'],
    // 排除的 glob（可多个）
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Unicode 正则（默认提取汉字）
    // characterPattern: '\\p{Script=Han}',
  },

  // 字体源目录及输出配置
  fonts: {
    // 源字体目录（只读该目录下 .ttf，不递归子目录）
    src: 'fonts',
    // 输出字体目录
    dest: 'dist/fonts',
    // 输出格式，逗号分隔，如：ttf, woff, woff2
    formats: ['woff', 'woff2'],
  },

  // 字形子集化：是否保留 TTF 微调信息（fpgm/prep/cvt），保留可提升小字号渲染，但略增体积，默认 false
  glyph: {
    hinting: false,
  },

  // 报告输出（如 CI 需要 JSON 报告可用 CLI --json 覆盖）
  report: {
    json: false,
  },
})
```

## 命令与选项

- `fontminify build` — 完整流程：读预置字 → 扫描项目字符 → 合并去重 → 批量子集化 → 输出统计
- `fontminify collect` — 只收集并输出要保留的字符（不生成字体）
- `fontminify init` — 在当前目录生成 `fontminify.config.js` 配置文件
- `fontminify presets list` — 列出所有内置预设字库
- `fontminify presets generate` — 把内置预设导出为文件以便修改

### `fontminify build`

完整流程：读预置字 → 扫描项目字符 → 合并去重 → 批量子集化 → 输出统计。

| 选项                          | 说明                                                  | 配置项                     |
| ----------------------------- | ----------------------------------------------------- | -------------------------- |
| `-c, --config <path>`         | 配置文件路径（默认 `fontminify.config.js`）           | —                          |
| `--preset <path...>`          | 预置字库文件（可多个）                                | `presetCharsFile`          |
| `--include <glob...>`         | 要扫描的文件 glob（可多个）                           | `collect.include`          |
| `--exclude <glob...>`         | 排除的 glob                                           | `collect.exclude`          |
| `--character-pattern <regex>` | 提取字符的 Unicode 正则（默认 `\p{Script=Han}`）      | `collect.characterPattern` |
| `--font-src <dir>`            | 源字体目录（只读该目录下 `.ttf` 文件，不递归子目录）  | `fonts.src`                |
| `--font-dest <dir>`           | 输出字体目录                                          | `fonts.dest`               |
| `--formats <list>`            | 输出格式，逗号分隔，如：`ttf`, `woff`, `woff2`        | `fonts.formats`            |
| `--dry-run`                   | 只扫描预估，不生成字体                                | —                          |
| `--chars-out <path>`          | 将最终要保留的字符写入文件                            | —                          |
| `--silent`                    | 不打印进度（若同时启用 `--json`，仍会输出 JSON 报告） | —                          |
| `--json`                      | 报告以 JSON 输出到 stdout                             | `report.json`              |

### `fontminify init`

在当前目录生成 `fontminify.config.js`。若配置文件已存在，默认情况下会报错，可加 `--force` 覆盖。

### `fontminify collect`

只收集并输出要保留的字符，不进行子集化。常用于调试。

```bash
# 默认输出到 stdout
$ fontminify collect                    # 输出到 stdout

# 写入文件
$ fontminify collect --out chars.txt

# JSON 输出
$ fontminify collect --json | jq .count
```

### `fontminify presets list`

列出所有内置预设字库。

目前仅收集了简体中文、繁体中文、香港常用字、台湾常用字、ASCII 字符。欢迎提交 PR 补充更多预设字库。👋

| 预设名                                  | 说明                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `zh-CN-common-characters`               | [现代汉语常用字](./src/templates/presets/zh-CN-common-characters.txt)（2500 字）🇨🇳                          |
| `zh-CN-secondary-characters`            | [现代汉语次常用字](./src/templates/presets/zh-CN-secondary-characters.txt)（1000 字）🇨🇳                     |
| `zh-CN-common-and-secondary-characters` | [现代汉语常用字 + 次常用字](./src/templates/presets/zh-CN-common-and-secondary-characters.txt)（3500 字）🇨🇳 |
| `zh-CN-punctuation-characters`          | [现代汉语标点符号](./src/templates/presets/zh-CN-punctuation-characters.txt) 🇨🇳                             |
| `zh-HK-common-characters`               | [香港常用字](./src/templates/presets/zh-HK-common-characters.txt)（4762 字）🇨🇳 🇭🇰 🇲🇴                        |
| `zh-TW-common-characters`               | [台湾常用字](./src/templates/presets/zh-TW-common-characters.txt)（4808 字）🇨🇳                              |
| `ascii-characters`                      | [ASCII 字符](./src/templates/presets/ascii-characters.txt) 🇺🇸                                               |

通常情况下，可能要多个预设进行组合，比如现代汉语常用字 + 次常用字 + 标点符号 + ASCII 字符（按需选择）。

### `fontminify presets generate`

内置了多个预设字库，使用 `fontminify presets generate` 可快速导出。若预设不满足需求，导出后可自行增删。

```bash
# 交互式选择预设和输出路径
$ fontminify presets generate

# 交互式选择预设
$ fontminify presets generate --out preset-chars.txt

# 指定预设及输出路径
$ fontminify presets generate zh-CN-common-and-secondary-characters --out preset-chars.txt
```

## Node API

### 方法

| 方法                                         | 说明                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `getResolvedConfig(configPath?, overrides?)` | 从配置文件（可选）与覆盖项解析出完整配置，返回 `Promise<ResolvedFontminifyConfig>`。                        |
| `buildSubset(config, options?)`              | 执行完整流程：读预设 → 扫描字符 → 合并 → 子集化字体 → 返回统计报告。`options.dryRun` 为 `true` 时不写文件。 |
| `collectProjectChars(config)`                | 仅收集字符：读预设 + 扫描项目，返回 `{ presetChars, scannedChars, finalText }`，不进行子集化。              |
| `defineConfig(config)`                       | 定义配置对象的辅助函数，便于 TypeScript 类型推断。                                                          |
| `validateResolvedConfig(config)`             | 校验已解析的配置是否完整、合法，非法时抛错。                                                                |

### 类型与错误

- **配置**：`FontminifyConfig`、`ResolvedFontminifyConfig`、`CollectConfig`、`FontsConfig`、`GlyphConfig`、`ReportConfig`
- **结果**：`BuildReport`、`FontSubsetResult`、`FontFormat`
- **错误**：`FontminifyError`（含 `code`：`USER_ERROR` / `RUNTIME_ERROR` / `EMPTY_CHARACTER_LIST`）

### 示例

```ts
import { buildSubset, getResolvedConfig } from '@tofrankie/fontminify'

const config = await getResolvedConfig(undefined, {
  fonts: { src: 'fonts', dest: 'dist/fonts', formats: ['woff2'] },
})
const report = await buildSubset(config)
console.log(`Saved ${report.totalSavedBytes} bytes`)
```

### CI 与退出码

```bash
$ fontminify build --json > font-report.json
```

| 退出码 | 含义                                        |
| ------ | ------------------------------------------- |
| 0      | 正常完成                                    |
| 1      | 参数/路径错误、未收集到任何字符等可修复问题 |
| 2      | 子集化或 IO 错误                            |

## License

MIT
