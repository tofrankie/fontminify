import { defineConfig } from '@tofrankie/eslint'

export default defineConfig(
  {
    ignores: ['node_modules', 'dist', '**/*.md'],
    typescript: true,
    rules: {
      'e18e/prefer-array-to-sorted': 'off',
    },
  },
  {
    files: ['tests/**/*.test.ts'],
    rules: {
      'e18e/prefer-static-regex': 'off',
    },
  }
)
