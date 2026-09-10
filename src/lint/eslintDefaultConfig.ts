import type { Linter } from 'eslint';
import stylistic from '@stylistic/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export const eslintDefaultConfig: Linter.Config[] = [
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2019,
                sourceType: 'module',
            },
        },
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            '@stylistic/padded-blocks': ['error', { blocks: 'never', classes: 'always', switches: 'always' }],
            '@stylistic/lines-between-class-members': ['error', 'always'],
            '@stylistic/object-curly-newline': ['error', {
                'ObjectExpression': 'always',
                'ObjectPattern': { 'multiline': true },
                'ImportDeclaration': { 'multiline': true, 'minProperties': 3 },
                'ExportDeclaration': { 'multiline': true, 'minProperties': 3 },
            }],
            '@stylistic/object-property-newline': ['error'],
            '@stylistic/indent': ['error', 'tab'],
        },
    },
];
