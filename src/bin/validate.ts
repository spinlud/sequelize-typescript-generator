import { Dialect } from '../dialects/Dialect';

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
 * Validate arguments
 * @param { [key: string]: any } argv
 * @returns {void}
 */
export const validateArgs = (argv: { [key: string]: any }): void => {
    // Validate dialect
    if (!Dialect.dialects.has(argv[aliasesMap.DIALECT])) {
        error(`Required argument -D <dialect> must be one of (${Array.from(Dialect.dialects).join(', ')})`);
    }

    // Validate port if any
    if (argv[aliasesMap.PORT] && (!Number.isInteger(argv[aliasesMap.PORT]) && argv[aliasesMap.PORT] <= 0)) {
        error(`Argument -p [port] must be a positive integer`);
    }

    // TODO Validate schema if dialect is postgres ?
}
