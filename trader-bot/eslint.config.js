import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Customize rules for JavaScript
      'no-unused-vars': 'warn',
      'no-console': 'off', // Allow console.log in this project
      'no-undef': 'error', // Make undefined variables warnings instead of errors
    },
  },
  {
    files: ['eslint.config.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
];
