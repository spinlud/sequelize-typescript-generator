import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const fixturePath = path.join(currentDir, 'fixtures', 'readmeProgrammaticExample.ts');
const barrelPath = path.join(repoRoot, 'src', 'index.ts');
const readmePath = path.join(repoRoot, 'README.md');

const TYPESCRIPT_FENCE_PATTERN = /```(?:ts|typescript)\n([\s\S]*?)```/g;

/**
 * Extract the fenced ts/typescript code blocks from a Markdown document.
 * @param {string} markdown
 * @returns {string[]}
 */
const extractTypeScriptBlocks = (markdown: string): string[] =>
    [...markdown.matchAll(TYPESCRIPT_FENCE_PATTERN)].map(match => match[1]);

describe('README programmatic example', () => {
    it('matches the fixture file so the README example cannot drift', () => {
        const markdown = fs.readFileSync(readmePath, 'utf8');
        const exampleBlocks = extractTypeScriptBlocks(markdown)
            .filter(block => block.includes('createDialect(') && block.includes('new ModelBuilder('));

        expect(exampleBlocks.length).toBeGreaterThan(0);

        const mainExample = exampleBlocks[0].trim();
        const fixture = fs.readFileSync(fixturePath, 'utf8').trim();

        expect(mainExample).toBe(fixture);
    });

    it('compiles against the root barrel only, with zero diagnostics', () => {
        const compilerOptions: ts.CompilerOptions = {
            strict: true,
            noEmit: true,
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            esModuleInterop: true,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            skipLibCheck: true,
            types: ['node'],
            paths: {
                'sequelize-typescript-generator': [barrelPath],
            },
        };

        const program = ts.createProgram([fixturePath], compilerOptions);

        const diagnostics = [
            ...program.getOptionsDiagnostics(),
            ...program.getGlobalDiagnostics(),
            ...program.getSyntacticDiagnostics(),
            ...program.getSemanticDiagnostics(),
        ];

        const messages = diagnostics.map(d =>
            ts.flattenDiagnosticMessageText(d.messageText, '\n')
        );

        expect(messages).toEqual([]);
    });
});
