import path from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const fixturePath = path.join(currentDir, 'fixtures', 'readmeProgrammaticExample.ts');
const barrelPath = path.join(repoRoot, 'src', 'index.ts');

describe('README programmatic example', () => {
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
