import { Options, Dialect as DialectType } from 'sequelize';

/**
 * Build sequelize options from environment
 * @param {DialectType}  dialect
 * @returns {Options}
 */
export const buildSequelizeOptions = (dialect: DialectType): Options => {
    let sequelizeOptions: Options = {};

    sequelizeOptions.dialect = dialect;

    sequelizeOptions.logging = false;

    if (process.env.TEST_DB_HOST) {
        sequelizeOptions.host = process.env.TEST_DB_HOST;
    }

    if (process.env.TEST_DB_PORT) {
        sequelizeOptions.port = parseInt(process.env.TEST_DB_PORT);
    }

    if (process.env.TEST_DB_DATABASE) {
        sequelizeOptions.database = process.env.TEST_DB_DATABASE;
    }

    if (process.env.TEST_DB_USERNAME) {
        sequelizeOptions.username = process.env.TEST_DB_USERNAME;
    }

    if (process.env.TEST_DB_PASSWORD) {
        sequelizeOptions.password = process.env.TEST_DB_PASSWORD;
    }

    return sequelizeOptions;
};
