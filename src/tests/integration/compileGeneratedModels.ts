import path from 'path';
import { promises as fs } from 'fs';
import * as ts from 'typescript';
import { Format } from './formats.js';

/**
 * Compiler options common to both output formats: strict type-checking with no
 * emit, ES2022 classes, ESNext modules and `bundler` resolution so the
 * extension-less relative specifiers the generator emits resolve, plus node
 * globals.
 */
const BASE_COMPILER_OPTIONS: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
    skipLibCheck: true,
    types: ['node'],
};

/**
 * Compiler options per output format.
 *
 * Decorators output enables decorator support and node globals and keeps
 * `useDefineForClassFields` off (the same setting `jest.config.cjs` applies):
 * the models declare plain public class fields that shadow Sequelize's
 * attribute getters and setters, so emitting real fields would both break at
 * runtime and raise TS2612 for the primary key field overriding `Model`.
 *
 * Native output uses no decorator flags and turns `useDefineForClassFields`
 * on: the models declare their fields with `declare`, which emits nothing under
 * either setting, and the runtime relies on Sequelize's `Model.init`.
 */
const COMPILER_OPTIONS_BY_FORMAT: Record<Format, ts.CompilerOptions> = {
    decorators: {
        ...BASE_COMPILER_OPTIONS,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false,
    },
    native: {
        ...BASE_COMPILER_OPTIONS,
        useDefineForClassFields: true,
    },
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
 * mode and return the syntactic and semantic diagnostics. The compiler options
 * follow the given output format.
 * @param {string} dir
 * @param {Format} format
 * @returns {Promise<ts.Diagnostic[]>}
 */
export const compileGeneratedModels = async (dir: string, format: Format): Promise<ts.Diagnostic[]> => {
    const files = await listTypescriptFiles(dir);
    const program = ts.createProgram(files, COMPILER_OPTIONS_BY_FORMAT[format]);

    return [
        ...program.getOptionsDiagnostics(),
        ...program.getGlobalDiagnostics(),
        ...program.getSyntacticDiagnostics(),
        ...program.getSemanticDiagnostics(),
    ];
};
