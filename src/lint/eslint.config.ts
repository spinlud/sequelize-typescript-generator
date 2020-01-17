export const eslintConfig = {
    parser:  '@typescript-eslint/parser',
    parserOptions:  {
        ecmaVersion:  2018,
        sourceType:  'module',
    },
    plugins: [
        '@typescript-eslint',
        'eslint-plugin-import',
    ],
    extends:  [
        // 'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
    ],
    rules:  {
        'padded-blocks': ['error', { blocks: 'always', classes: 'always', switches: 'always' }],
        'lines-between-class-members': ['error', 'always' ],
        'import/newline-after-import': ['error', { 'count': 2 }],
        'object-curly-newline': ['error', {
            'ObjectExpression': 'always',
            'ObjectPattern': { 'multiline': true },
            'ImportDeclaration': { 'multiline': true, 'minProperties': 3 },
            'ExportDeclaration': { 'multiline': true, 'minProperties': 3 },
        }],
        'object-property-newline': ['error'],
        'indent': ['error', 'tab'],
    },
};
