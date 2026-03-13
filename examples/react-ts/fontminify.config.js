import { defineConfig } from '@tofrankie/fontminify'

export default defineConfig({
  presetCharsFile: ['public/fonts-original/preset-chars.txt'],
  collect: {
    include: ['src/**/*.{json,js,jsx,ts,tsx,vue}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  fonts: {
    src: 'public/fonts-original',
    dest: 'public/fonts',
    formats: ['woff2'],
  },
})
