import { Options } from 'sequelize';

export type Case = 'UPPER' | 'LOWER' | 'UNDERSCORE' | 'CAMEL' | 'PASCAL' | 'CONST';

export const Cases = new Set<Case>([
    'UPPER',
    'LOWER',
    'UNDERSCORE',
    'CAMEL',
    'PASCAL',
    'CONST'
]);

export interface IConfig {
    connection: Options,
    metadata?: {
        tables?: string[],
        skipTables?: string[],
        indices?: boolean,
        timestamps?: boolean,
        case?: Case,
    },
    output: {
        clean?: boolean, // clean output dir before build
        outDir: string, // output directory
    }
}
