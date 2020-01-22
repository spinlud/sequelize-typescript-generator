import path from 'path';
import { Dialect as DialectType } from 'sequelize';
import { IConfig } from '../config';
import { Dialect } from '../dialects/Dialect';
import { DialectMySQL } from '../dialects';

export type ArgvType = { [key: string]: any };

export const defaultOutputDir = 'output-models';

export const aliasesMap = {
    HOST: 'host',
    PORT: 'port',
    DATABASE: 'database',
    DIALECT: 'dialect',
    SCHEMA: 'schema',
    USERNAME: 'username',
    PASSWORD: 'password',
    TABLES: 'tables',
    SKIP_TABLES: 'skip-tables',
    OUTPUT_DIR: 'out-dir',
    OUTPUT_DIR_CLEAN: 'clean',
    INDICES: 'indices',
    TIMESTAMPS: 'timestamps',
    CAMELCASE: 'camel',
    UNDERSCORE: 'underscore',
}

/**
 * Diplay error message and exit
 * @param {string} msg
 * @returns {void}
 */
export const error = (msg: string): void => {
    console.error('[ValidationError]', msg);
    process.exit(1);
}

/**
 * Build config object from parsed arguments
 * @param { [key: string]: any } argv
 * Returns {IConfig}
 */
export const buildConfig = (argv: ArgvType): IConfig => {
    const config: IConfig = {
        connection: {
            dialect: argv[aliasesMap.DIALECT] as DialectType,
            ...argv[aliasesMap.HOST] && {host: argv[aliasesMap.HOST] as string},
            ...argv[aliasesMap.PORT] && {port: argv[aliasesMap.PORT] as number},
            database: argv[aliasesMap.DATABASE] as string,
            username: argv[aliasesMap.USERNAME] as string,
            ...argv[aliasesMap.PASSWORD] && {password: argv[aliasesMap.PASSWORD] as string},
        },
        metadata: {
            ...argv[aliasesMap.TABLES] && {tables: (argv[aliasesMap.TABLES] as string)
                    .split(',')
                    .map(tableName => tableName.toLowerCase())
            },
            ...argv[aliasesMap.SKIP_TABLES] && {skipTables: (argv[aliasesMap.SKIP_TABLES] as string)
                    .split(',')
                    .map(tableName => tableName.toLowerCase())
            },
            camelCased: !!argv[aliasesMap.CAMELCASE],
            underscored: !!argv[aliasesMap.UNDERSCORE],
            indices: !!argv[aliasesMap.INDICES],
            timestamps: !!argv[aliasesMap.TIMESTAMPS],
        },
        output: {
            outDir: argv[aliasesMap.OUTPUT_DIR] ?
                path.isAbsolute(argv[aliasesMap.OUTPUT_DIR] as string) ?
                    argv[aliasesMap.OUTPUT_DIR] as string
                    : path.join(process.cwd(), argv[aliasesMap.OUTPUT_DIR] as string)
                : path.join(process.cwd(), defaultOutputDir),
            clean: !!argv[aliasesMap.OUTPUT_DIR_CLEAN],
        }
    };

    return config;
}

/**
 * Build dialect object from parsed arguments
 * @param { [key: string]: any } argv
 * Returns {Dialect}
 */
export const buildDialect = (argv: ArgvType): Dialect => {
    let dialect: Dialect;

    switch (argv[aliasesMap.DIALECT]) {
        case 'postgres':
            dialect = new DialectMySQL(); // TODO
            break;
        case 'mysql':
            dialect = new DialectMySQL();
            break;
        case 'mariadb':
            dialect = new DialectMySQL(); // TODO
            break;
        case 'sqlite':
            dialect = new DialectMySQL(); // TODO
            break;
        case 'mssql':
            dialect = new DialectMySQL(); // TODO
            break;
        default:
            error(`Unknown dialect ${argv[aliasesMap.DIALECT]}`);
    }

    return dialect!;
}

/**
 * Validate arguments
 * @param { [key: string]: any } argv
 * @returns {void}
 */
export const validateArgs = (argv: ArgvType): void => {
    // Validate dialect
    if (!Dialect.dialects.has(argv[aliasesMap.DIALECT])) {
        error(`Required argument -D <dialect> must be one of (${Array.from(Dialect.dialects).join(', ')})`);
    }

    // Validate port if any
    if (argv[aliasesMap.PORT] && (!Number.isInteger(argv[aliasesMap.PORT]) || argv[aliasesMap.PORT] <= 0)) {
        error(`Argument -p [port] must be a positive integer (${argv[aliasesMap.PORT]})`);
    }

    // TODO Validate schema if dialect is postgres ?
}
