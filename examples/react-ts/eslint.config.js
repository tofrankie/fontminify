import { defineConfig } from '@tofrankie/eslint'

export default defineConfig({
  ignores: ['node_modules', 'dist'],
  typescript: true,
  react: true,
})
