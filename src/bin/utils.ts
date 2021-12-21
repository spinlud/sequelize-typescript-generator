import path from 'path';
import fs from 'fs';
import { Dialect as DialectType } from 'sequelize';
import { Dialect } from '../dialects/Dialect';

import {
    DialectMySQL,
    DialectPostgres,
    DialectMSSQL,
    DialectMariaDB,
    DialectSQLite,
} from '../dialects';

import {
    IConfig,
    TransformCases,
    TransformCase,
    TransformMap,
    TransformTarget
} from '../config/IConfig';

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
    CASE: 'case',
    STORAGE: 'storage',
    LINT_FILE: 'lint-file',
    SSL: 'ssl',
    PROTOCOL: 'protocol',
    ASSOCIATIONS_FILE: 'associations-file',
    ENABLE_SEQUELIZE_LOGS: 'logs',
    DIALECT_OPTIONS: 'dialect-options',
    DIALECT_OPTIONS_FILE: 'dialect-options-file',
    DISABLE_STRICT: 'no-strict',
    DISABLE_VIEWS: 'no-views',
};

/**
 * Diplay error message and exit
 * @param {string} msg
 * @returns {void}
 */
export const error = (msg: string): void => {
    console.error('[ValidationError]', msg);
    process.exit(1);
};

/**
 * Parse case argument
 * @param {string} arg
 * @returns { TransformCase | TransformMap }
 */
export const parseCase = (arg: string): TransformCase | TransformMap => {
    if (arg.includes(':')) {
        const tokens = arg.split(':');
        const modelCase = tokens[0].toUpperCase() as TransformCase;
        const columnCase = tokens[1].toUpperCase() as TransformCase;

        return {
            [TransformTarget.MODEL]: modelCase,
            [TransformTarget.COLUMN]: columnCase
        };
    }

    return arg.toUpperCase() as TransformCase;
};

/**
 * Parse dialect options from json string
 * @param {string} json
 * @returns {object} Dialect options object
 */
const buildDialectOptionsFromString = (json: string): object => {
    let parsed: object;

    try {
        parsed = JSON.parse(json);
    }
    catch(err) {
        console.error(`Invalid json for argument --dialect-options`, err);
        process.exit(1);
    }

    return parsed;
};

/**
 * Parse dialect options from json file
 * @param {string} path
 * @returns {object} Dialect options object
 */
const buildDialectOptionsFromFile = (path: string): object => {
    let content: string;
    let parsed: object;

    try {
        content = fs.readFileSync(path).toString();
    }
    catch(err) {
        error(`Argument -f [--dialect-options-file] '${path}' is not a valid path`);
    }

    try {
        parsed = JSON.parse(content!);
    }
    catch(err) {
        console.error(`Invalid json for argument --dialect-options`, err);
        process.exit(1);
    }

    return parsed;
};

/**
 * Build config object from parsed arguments
 * @param { [key: string]: any } argv
 * Returns {IConfig}
 */
export const buildConfig = (argv: ArgvType): IConfig => {
    const config: IConfig = {
        connection: {
            dialect: argv[aliasesMap.DIALECT] as DialectType,
            ...argv[aliasesMap.HOST] && { host: argv[aliasesMap.HOST] as string },
            ...argv[aliasesMap.PORT] && { port: argv[aliasesMap.PORT] as number },
            ...argv[aliasesMap.DATABASE] && { database: argv[aliasesMap.DATABASE] as string },
            ...argv[aliasesMap.USERNAME] && { username: argv[aliasesMap.USERNAME] as string },
            ...argv[aliasesMap.PASSWORD] && { password: argv[aliasesMap.PASSWORD] as string },
            ...argv[aliasesMap.SSL] && { ssl: true },
            ...argv[aliasesMap.PROTOCOL] && { protocol: argv[aliasesMap.PROTOCOL] as string },

            ...argv[aliasesMap.DIALECT] === 'mariadb' && { dialectOptions: {
                    timezone: 'Etc/GMT-3',
                }
            },

            ...argv[aliasesMap.DIALECT] === 'sqlite' && {
                storage: argv[aliasesMap.STORAGE] ?? 'memory',
            },

            ...argv[aliasesMap.DIALECT_OPTIONS_FILE] && {
                dialectOptions: buildDialectOptionsFromFile(argv[aliasesMap.DIALECT_OPTIONS_FILE]),
            },

            ...argv[aliasesMap.DIALECT_OPTIONS] && {
                dialectOptions: buildDialectOptionsFromString(argv[aliasesMap.DIALECT_OPTIONS]),
            },

            logQueryParameters: true,
            logging: argv[aliasesMap.ENABLE_SEQUELIZE_LOGS],
        },
        metadata: {
            ...argv[aliasesMap.SCHEMA] && { schema: argv[aliasesMap.SCHEMA] as string },
            ...argv[aliasesMap.TABLES] && {
                tables: (argv[aliasesMap.TABLES] as string)
                    .split(',')
                    .map(tableName => tableName.toLowerCase())
            },
            ...argv[aliasesMap.SKIP_TABLES] && {
                skipTables: (argv[aliasesMap.SKIP_TABLES] as string)
                    .split(',')
                    .map(tableName => tableName.toLowerCase())
            },
            indices: !!argv[aliasesMap.INDICES],
            timestamps: !!argv[aliasesMap.TIMESTAMPS],
            ...argv[aliasesMap.CASE] && { case: parseCase(argv[aliasesMap.CASE]) },
            ...argv[aliasesMap.ASSOCIATIONS_FILE] && { associationsFile: argv[aliasesMap.ASSOCIATIONS_FILE] as string },
            noViews: !!argv[aliasesMap.DISABLE_VIEWS],
        },
        output: {
            outDir: argv[aliasesMap.OUTPUT_DIR] ?
                path.isAbsolute(argv[aliasesMap.OUTPUT_DIR] as string) ?
                    argv[aliasesMap.OUTPUT_DIR] as string
                    : path.join(process.cwd(), argv[aliasesMap.OUTPUT_DIR] as string)
                : path.join(process.cwd(), defaultOutputDir),
            clean: !!argv[aliasesMap.OUTPUT_DIR_CLEAN],
        },
        strict: !(!!argv[aliasesMap.DISABLE_STRICT]),
        ...argv[aliasesMap.LINT_FILE] && {
            lintOptions: {
                configFile: argv[aliasesMap.LINT_FILE],
                fix: true,
            }
        },
    };

    return config;
};

/**
 * Build dialect object from parsed arguments
 * @param { [key: string]: any } argv
 * Returns {Dialect}
 */
export const buildDialect = (argv: ArgvType): Dialect => {
    let dialect: Dialect;

    switch (argv[aliasesMap.DIALECT]) {
        case 'postgres':
            dialect = new DialectPostgres();
            break;
        case 'mysql':
            dialect = new DialectMySQL();
            break;
        case 'mariadb':
            dialect = new DialectMariaDB();
            break;
        case 'sqlite':
            dialect = new DialectSQLite();
            break;
        case 'mssql':
            dialect = new DialectMSSQL();
            break;
        default:
            error(`Unknown dialect ${argv[aliasesMap.DIALECT]}`);
    }

    return dialect!;
};

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

    // Validate database
    if (argv[aliasesMap.DIALECT] !== 'sqlite' && !argv[aliasesMap.DATABASE]) {
        error(`Argument -d [database] is required for dialect ${argv[aliasesMap.DIALECT]}`);
    }

    // Validate port
    if (argv[aliasesMap.PORT] && (!Number.isInteger(argv[aliasesMap.PORT]) || argv[aliasesMap.PORT] <= 0)) {
        error(`Argument -p [port] must be a positive integer (${argv[aliasesMap.PORT]})`);
    }

    // Validate case
    if (argv[aliasesMap.CASE]) {
        if (argv[aliasesMap.CASE].includes(':')) {
            const tokens = argv[aliasesMap.CASE].split(':');
            const modelCase = tokens[0].toUpperCase();
            const columnCase = tokens[1].toUpperCase();

            if (!TransformCases.has(modelCase)) {
                error(`Unknown case '${modelCase}': must be one of (${Array.from(TransformCases).join(', ').toLowerCase()})`);
            }

            if (!TransformCases.has(columnCase)) {
                error(`Unknown case '${columnCase}': must be one of (${Array.from(TransformCases).join(', ').toLowerCase()})`);
            }
        }
        else if (!TransformCases.has(argv[aliasesMap.CASE].toUpperCase())) {
            error(`Argument -c [case] must be one of (${Array.from(TransformCases).join(', ').toLowerCase()})`);
        }
    }

    // Validate lint file
    if (argv[aliasesMap.LINT_FILE]) {
        try {
            fs.accessSync(argv[aliasesMap.LINT_FILE]);
        }
        catch(err) {
            error(`Argument -L [lint-file] '${argv[aliasesMap.LINT_FILE]}' is not a valid path`);
        }
    }

    // Validate associations file
    if (argv[aliasesMap.ASSOCIATIONS_FILE]) {
        try {
            fs.accessSync(argv[aliasesMap.ASSOCIATIONS_FILE]);
        }
        catch(err) {
            error(`Argument -a [associations-file] '${argv[aliasesMap.ASSOCIATIONS_FILE]}' is not a valid path`);
        }
    }

    // TODO Validate schema if dialect is postgres ?
};
