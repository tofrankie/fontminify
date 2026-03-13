# React + TypeScript + Vite

## 字体子集化说明（fontminify）

本示例已接入 [@tofrankie/fontminify](https://github.com/tofrankie/fontminify)：

1. 将 `.ttf` 字体放入 **`public/fonts-original/`**（例如 `public/fonts-original/MiSans-Normal.ttf`）。
2. 执行 **`pnpm font:minify`**，按 `src/` 扫描结果生成子集字体，输出 woff2/woff 到 **`public/fonts/`**。
3. 正常构建：**`pnpm build`**。若希望先子集化再构建，可执行 **`pnpm build:with-fonts`**。

若 TTF 未命名为 `SubsetFont.ttf`，请在 `src/index.css` 中修改 `@font-face` 的 `src`，使其指向实际生成的文件（如 `/fonts/你的字体名.woff2`）。首页 “Get started” 下方段落会使用该子集字体（当字体存在时）。

```bash
$ pnpm font:preset                                                                                                           [3:23:58]

> react-ts@0.0.0 font:preset /Users/frankie/Web/Git/fontminify/examples/react-ts
> fontminify presets generate --out public/fonts-original/preset-chars.txt --force

✔ Select a preset Modern Chinese common + secondary characters (3,500 chars) / 现代汉语常用字 + 次常用字（共 3500 字）
Generated "/Users/frankie/Web/Git/fontminify/examples/react-ts/public/fonts-original/preset-chars.txt" (Modern Chinese common + secondary characters (3,500 chars))

$ pnpm font:minify
fontminify: collecting chars...
fontminify: minifying fonts (3501 chars)...

fontminify report
────────────────────────────────────────────────────────────
Chars  preset: 3,500  scanned: 19  total: 3,501

MiSans-Normal
  WOFF2 7.82MB → 433.92KB  -7.40MB (94.6%)  public/fonts/MiSans-Normal.woff2

────────────────────────────────────────────────────────────
Total  7.82MB → 433.92KB  -7.40MB (94.6%)  Done in 5.8s
```

---

## Font subsetting (fontminify)

This example is wired for [@tofrankie/fontminify](https://github.com/tofrankie/fontminify):

1. Put your `.ttf` font file(s) in **`public/fonts-original/`** (e.g. `public/fonts-original/MiSans-Normal.ttf`).
2. Run **`pnpm font:minify`** to subset fonts by scanning `src/` and writing woff2/woff to **`public/fonts/`**.
3. Build as usual: **`pnpm build`**. To subset then build in one step: **`pnpm build:with-fonts`**.

If your TTF is not named `SubsetFont.ttf`, update the `@font-face` `src` in `src/index.css` to match the generated file (e.g. `/fonts/YourFontName.woff2`). The paragraph under “Get started” uses the subset font when available.
