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

export interface IConfigMetadata {
    tables?: string[];
    skipTables?: string[];
    indices?: boolean;
    timestamps?: boolean;
    paranoid?: boolean; // Emit paranoid table options; requires timestamps
    case?: TransformCase | TransformMap | TransformFn;
    associationsFile?: string;
    associations?: boolean; // Discover associations from foreign keys; undefined means enabled
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
