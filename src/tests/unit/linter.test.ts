import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { Linter, assertFlatConfig } from '../../lint/Linter.js';

const MIGRATION_GUIDE_URL = 'https://eslint.org/docs/latest/use/configure/migration-guide';

const makeTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'stg-linter-'));

describe('Linter', () => {

    describe('assertFlatConfig', () => {

        it('should reject a config object with an "extends" key', () => {
            const sourcePath = '/tmp/legacy-extends.js';

            expect(() => assertFlatConfig({ extends: ['eslint:recommended'] }, sourcePath))
                .toThrow(MIGRATION_GUIDE_URL);
            expect(() => assertFlatConfig({ extends: ['eslint:recommended'] }, sourcePath))
                .toThrow(sourcePath);
        });

        it('should reject a config object with an "env" key', () => {
            const sourcePath = '/tmp/legacy-env.js';

            expect(() => assertFlatConfig({ env: { node: true } }, sourcePath))
                .toThrow(MIGRATION_GUIDE_URL);
        });

        it('should reject a config object with a string "parser"', () => {
            const sourcePath = '/tmp/legacy-parser.js';

            expect(() => assertFlatConfig({ parser: '@typescript-eslint/parser' }, sourcePath))
                .toThrow(MIGRATION_GUIDE_URL);
        });

        it('should reject a legacy element nested inside a config array', () => {
            const sourcePath = '/tmp/legacy-array.js';
            const config = [
                { rules: {} },
                { env: { browser: true } },
            ];

            expect(() => assertFlatConfig(config, sourcePath)).toThrow(MIGRATION_GUIDE_URL);
        });

        it('should accept a flat config array with an object parser in languageOptions', () => {
            const sourcePath = '/tmp/flat.mjs';
            const config = [
                {
                    languageOptions: {
                        parser: { parseForESLint: (): unknown => ({ ast: {} }) },
                        parserOptions: { ecmaVersion: 2019, sourceType: 'module' },
                    },
                    rules: { '@stylistic/indent': ['error', 'tab'] },
                },
            ];

            expect(() => assertFlatConfig(config, sourcePath)).not.toThrow();
        });

    });

    describe('constructor legacy path guard', () => {

        it('should reject a lint file named .eslintrc.json before touching ESLint', () => {
            const dir = makeTempDir();
            const configFile = path.join(dir, '.eslintrc.json');
            fs.writeFileSync(configFile, JSON.stringify({ rules: {} }));

            expect(() => new Linter({ configFile })).toThrow(MIGRATION_GUIDE_URL);
        });

    });

    describe('end-to-end fixing', () => {

        const SPACE_INDENTED_SOURCE = [
            'export function sample(): number {',
            '  const value: number = 1;',
            '  return value;',
            '}',
            '',
        ].join('\n');

        const TAB_INDENTED_SOURCE = [
            'export function sample(): number {',
            '\tconst value: number = 1;',
            '\treturn value;',
            '}',
            '',
        ].join('\n');

        it('should reformat a file to tab indentation with the default config', async () => {
            const dir = makeTempDir();
            const target = path.join(dir, 'sample.ts');
            fs.writeFileSync(target, SPACE_INDENTED_SOURCE);

            const linter = new Linter();
            await linter.lintFiles([target]);

            const fixed = fs.readFileSync(target).toString();

            expect(fixed).toContain('\tconst value');
            expect(fixed).not.toContain('  const value');
        });

        it('should apply a flat config passed through --lint-file', async () => {
            const dir = makeTempDir();
            const target = path.join(dir, 'sample.ts');
            fs.writeFileSync(target, TAB_INDENTED_SOURCE);

            const requireFromRepo = createRequire(path.join(process.cwd(), 'package.json'));
            const stylisticUrl = pathToFileURL(requireFromRepo.resolve('@stylistic/eslint-plugin')).href;
            const parserUrl = pathToFileURL(requireFromRepo.resolve('@typescript-eslint/parser')).href;

            const configFile = path.join(dir, 'flat.config.mjs');
            const configSource = [
                `import stylistic from '${stylisticUrl}';`,
                `import parser from '${parserUrl}';`,
                'export default [',
                '    {',
                '        files: [\'**/*.ts\', \'**/*.tsx\'],',
                '        languageOptions: {',
                '            parser,',
                '            parserOptions: { ecmaVersion: 2019, sourceType: \'module\' },',
                '        },',
                '        plugins: { \'@stylistic\': stylistic },',
                '        rules: { \'@stylistic/indent\': [\'error\', 2] },',
                '    },',
                '];',
                '',
            ].join('\n');
            fs.writeFileSync(configFile, configSource);

            const linter = new Linter({ configFile, fix: true });
            await linter.lintFiles([target]);

            const fixed = fs.readFileSync(target).toString();

            expect(fixed).toContain('  const value');
            expect(fixed).not.toContain('\tconst value: number');
        });

    });

});
