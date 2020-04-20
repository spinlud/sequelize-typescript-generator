import { Options } from 'sequelize';
import { CLIEngine } from 'eslint';

export type TransformCase = 'UPPER' | 'LOWER' | 'UNDERSCORE' | 'CAMEL' | 'PASCAL' | 'CONST';
export enum TransformType {
    MODEL = 'model',
    COLUMN = 'column'
};
export type TransformCollection = {
    [key in TransformType]: TransformCase;
};
export type TransformFunction = (value: string, type: TransformType) => string;

export const TransformCases = new Set<TransformCase>([
    'UPPER',
    'LOWER',
    'UNDERSCORE',
    'CAMEL',
    'PASCAL',
    'CONST'
]);

export interface IConfigMetadata {
    schema?: 'public' | string; // Postgres only
    tables?: string[];
    skipTables?: string[];
    indices?: boolean;
    timestamps?: boolean;
    case?: TransformCase | TransformCollection | TransformFunction;
    associationsFile?: string;
}

export interface IConfigOutput {
    clean?: boolean; // clean output dir before build
    outDir: string; // output directory
}

export interface IConfig {
    connection: Options;
    metadata?: IConfigMetadata;
    output: IConfigOutput;
    lintOptions?: CLIEngine.Options;
}
