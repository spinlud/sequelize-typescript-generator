import { Options } from 'sequelize';
import type { Format } from './format.js';

export { FORMATS, DEFAULT_FORMAT, isFormat } from './format.js';
export type { Format } from './format.js';

export type TransformCase = 'UPPER' | 'LOWER' | 'UNDERSCORE' | 'CAMEL' | 'PASCAL' | 'CONST';

export enum TransformTarget {
    MODEL = 'model',
    COLUMN = 'column'
}

export type TransformMap = {
    [key in TransformTarget]: TransformCase;
}

export type TransformFn = (value: string, target: TransformTarget) => string;

export const TransformCases = new Set<TransformCase>([
    'UPPER',
    'LOWER',
    'UNDERSCORE',
    'CAMEL',
    'PASCAL',
    'CONST'
]);

/**
 * A type override entry: the TypeScript type, the Sequelize data type, or both.
 * `tsType` is any TypeScript type expression, e.g. `{ x: number }` or
 * `import('pkg').Type`; `dataType` is a Sequelize data type expression with an
 * optional `DataTypes.`/`DataType.` prefix, e.g. `STRING(255)` or
 * `ARRAY(ENUM('a', 'b'))`. A side left unset keeps the generated type.
 */
export interface ITypeOverride {
    tsType?: string;
    dataType?: string;
}

/**
 * Shape of the type overrides file. `types` keys are database type names, optionally
 * schema-qualified (`<type>` or `<schema>.<type>`); `columns` keys are
 * `<table>.<column>` or `<schema>.<table>.<column>`. Keys match case-insensitively.
 */
export interface ITypeOverrides {
    types?: Record<string, ITypeOverride>;
    columns?: Record<string, ITypeOverride>;
}

export interface IConfigMetadata {
    tables?: string[];
    skipTables?: string[];
    indices?: boolean;
    timestamps?: boolean;
    paranoid?: boolean; // Emit paranoid table options; requires timestamps
    case?: TransformCase | TransformMap | TransformFn;
    associationsFile?: string;
    associations?: boolean; // Discover associations from foreign keys; undefined means enabled
    typeOverridesFile?: string; // Path to a JSON type overrides file; exclusive with typeOverrides
    typeOverrides?: ITypeOverrides; // Type overrides in the type overrides file shape; exclusive with typeOverridesFile
    noViews?: boolean;
}

export interface IConfigOutput {
    clean?: boolean; // clean output dir before build
    outDir: string; // output directory
}

export interface ILintOptions {
    configFile: string; // path to an ESLint flat config file
    fix?: boolean; // apply fixable rules to the generated files
}

export interface IConfig {
    connection: Options;
    metadata?: IConfigMetadata;
    output: IConfigOutput;
    lintOptions?: ILintOptions;
    format?: Format; // undefined means native
    strict?: boolean; // decorators only; ignored with a notice in native
}
