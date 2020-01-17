import { Options } from 'sequelize';

export interface IConfig {
    connection: Options,
    metadata?: {
        tables?: string[],
        skipTables?: string[],
        camelCased?: boolean,
        underscored?: boolean,
        capitalized?: boolean,
        timestamps?: boolean,
    },
    output: {
        clean?: boolean, // clean output dir before build
        outDir: string, // output directory
    }
}
