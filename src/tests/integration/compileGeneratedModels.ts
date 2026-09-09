import path from 'path';
import { promises as fs } from 'fs';
import * as ts from 'typescript';

/**
 * Compiler options used to type-check generated model files in strict mode.
 * The generated decorators import each other with extension-less relative
 * specifiers (no `.js` suffix), so `bundler` module resolution is used to
 * resolve them; decorator support and node globals are enabled to match the
 * generator's output.
 *
 * `useDefineForClassFields` is off to match how the decorators output is meant
 * to be consumed (the same setting `jest.config.cjs` applies): the models
 * declare plain public class fields that shadow Sequelize's attribute getters
 * and setters, so emitting real fields would both break at runtime and raise
 * TS2612 for the primary key field overriding `Model`.
 */
const GENERATED_MODELS_COMPILER_OPTIONS: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    skipLibCheck: true,
    useDefineForClassFields: false,
    types: ['node'],
};

/**
 * List every `.ts` file directly inside a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
const listTypescriptFiles = async (dir: string): Promise<string[]> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    return entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
        .map(entry => path.join(dir, entry.name));
};

/**
 * Type-check every generated `.ts` file in the given directory under strict
 * mode and return the syntactic and semantic diagnostics.
 * @param {string} dir
 * @returns {Promise<ts.Diagnostic[]>}
 */
export const compileGeneratedModels = async (dir: string): Promise<ts.Diagnostic[]> => {
    const files = await listTypescriptFiles(dir);
    const program = ts.createProgram(files, GENERATED_MODELS_COMPILER_OPTIONS);

    return [
        ...program.getOptionsDiagnostics(),
        ...program.getGlobalDiagnostics(),
        ...program.getSyntacticDiagnostics(),
        ...program.getSemanticDiagnostics(),
    ];
};
