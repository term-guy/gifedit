import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import configPrettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'public'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
  configPrettier,
)
