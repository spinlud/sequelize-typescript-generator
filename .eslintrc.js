module.exports =  {
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
        'prettier/@typescript-eslint',
        // 'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
    ],
    rules:  {
        'padded-blocks': ['error', { blocks: 'always', classes: 'always', switches: 'always' }],
        'lines-between-class-members': ['error', 'always' ],
        'import/newline-after-import': ['error', { 'count': 2 }],
    },
};
