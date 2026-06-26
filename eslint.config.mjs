// ESLint 9 flat config. Replaces the tslint gate; prettier keeps style.
//
// Ported rules (tslint rule -> eslint rule):
//   no-shadowed-variable      -> no-shadow (@typescript-eslint/no-shadow)
//   no-empty                  -> no-empty
//   no-eval                   -> no-eval
//   no-debugger               -> no-debugger
//   no-switch-case-fall-through -> no-fallthrough
//   no-var-keyword            -> no-var
//   prefer-const              -> prefer-const
//   radix                     -> radix
//   no-console                -> no-console (allow warn/error)
//   no-duplicate-switch-case  -> no-duplicate-case
//   no-duplicate-variable     -> no-redeclare (@typescript-eslint/no-redeclare)
//   triple-equals             -> eqeqeq ("smart")
//   curly                     -> curly ("all")
//   use-isnan                 -> no-restricted-globals (isNaN)
//   no-internal-module        -> @typescript-eslint/no-namespace
//   class-name + variable-name -> @typescript-eslint/naming-convention
//   no-circular-imports       -> import/no-cycle (eslint-plugin-import)
//
// Dropped (no equivalent or covered elsewhere):
//   typedef, typedef-whitespace  -> codebase is typed by construction
//   no-construct                 -> TS rejects new on non-constructors
//   no-null-keyword              -> type style; convention is | undefined
//   no-implicit-dependencies     -> pnpm strict node_modules enforces deps
//   comment-format               -> comment prose is not lintable
//   forin                        -> rare construct
//   ordered-imports              -> lowercase-first ordering has no tooling
//   no-arg                       -> no core equivalent
//   member-ordering, member-access, interface-name, no-any, no-bitwise,
//   no-constant-condition, no-inferrable-types, no-string-literal,
//   no-unused-variable, no-unused-expression, no-default-export,
//   label-position               -> disabled in the tslint config
//   indent, max-line-length, quotemark, semicolon, trailing-comma,
//   no-trailing-whitespace, no-consecutive-blank-lines, one-line, whitespace,
//   eofline, object-literal-sort-keys -> prettier owns style

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';

export default [
  // Built output, vendored dirs, and planning artifacts never linted.
  {
    ignores: [
      '**/node_modules/**',
      '**/lib/**',
      '**/coverage/**',
      '**/.pi/**',
      '**/__tests__/data/corpus/ts-current/**',
    ],
  },

  // Plain JS: root config files, jest configs, the CLI bin shim, corpus tools.
  {
    files: ['**/*.js'],
    rules: {
      'no-shadow': 'error',
      'no-empty': 'error',
      'no-eval': 'error',
      'no-debugger': 'error',
      'no-fallthrough': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      radix: 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-duplicate-case': 'error',
      'no-redeclare': 'error',
      eqeqeq: ['error', 'smart'],
      curly: ['error', 'all'],
      'no-restricted-globals': [
        'error',
        { name: 'isNaN', message: 'Prefer Number.isNaN.' },
      ],
    },
  },

  // The corpus runner prints to stdout; the console is its interface.
  {
    files: ['**/__tests__/data/corpus/tools/**/*.js'],
    rules: { 'no-console': 'off' },
  },

  // TypeScript: ported rules, scoped to .ts so tests and scripts are covered.
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    settings: {
      'import/parsers': { '@typescript-eslint/parser': ['.ts'] },
      'import/extensions': ['.js', '.ts', '.json'],
      'import/resolver': {
        node: { extensions: ['.js', '.ts', '.json'] },
      },
    },
    rules: {
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      'no-empty': 'error',
      'no-eval': 'error',
      'no-debugger': 'error',
      'no-fallthrough': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      radix: 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-duplicate-case': 'error',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      eqeqeq: ['error', 'smart'],
      curly: ['error', 'all'],
      'no-restricted-globals': [
        'error',
        { name: 'isNaN', message: 'Prefer Number.isNaN.' },
      ],
      '@typescript-eslint/no-namespace': 'error',
      'import/no-cycle': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        // Mirrors tslint variable-name (check-format, allow-leading-underscore,
        // allow-pascal-case): lowerCamelCase, PascalCase, or UPPER_CASE.
        { selector: 'variable', format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
        { selector: 'parameter', format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
        { selector: 'classProperty', format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
        // Mirrors tslint class-name: classes and interfaces are PascalCase.
        { selector: 'class', format: ['PascalCase'] },
        { selector: 'interface', format: ['PascalCase'] },
      ],
    },
  },

  // Shut off rules that overlap prettier's domain.
  prettier,
];
