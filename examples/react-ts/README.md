# React + TypeScript + Vite

## 字体子集化说明（fontminify）

本示例已接入 [@tofrankie/fontminify](https://github.com/tofrankie/fontminify)：

1. 将 `.ttf` 字体放入 **`fonts/`**（例如 `fonts/SubsetFont.ttf`）。
2. 执行 **`pnpm font:minify`**，按 `src/` 扫描结果生成子集字体，输出 woff2/woff 到 **`public/fonts/`**。
3. 正常构建：**`pnpm build`**。若希望先子集化再构建，可执行 **`pnpm build:with-fonts`**。

若 TTF 未命名为 `SubsetFont.ttf`，请在 `src/index.css` 中修改 `@font-face` 的 `src`，使其指向实际生成的文件（如 `/fonts/你的字体名.woff2`）。首页 “Get started” 下方段落会使用该子集字体（当字体存在时）。

---

## Font subsetting (fontminify)

This example is wired for [@tofrankie/fontminify](https://github.com/tofrankie/fontminify):

1. Put your `.ttf` font file(s) in **`fonts/`** (e.g. `fonts/SubsetFont.ttf`).
2. Run **`pnpm font:minify`** to subset fonts by scanning `src/` and writing woff2/woff to **`public/fonts/`**.
3. Build as usual: **`pnpm build`**. To subset then build in one step: **`pnpm build:with-fonts`**.

If your TTF is not named `SubsetFont.ttf`, update the `@font-face` `src` in `src/index.css` to match the generated file (e.g. `/fonts/YourFontName.woff2`). The paragraph under “Get started” uses the subset font when available.
