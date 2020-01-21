import { Options, Dialect as DialectType } from 'sequelize';

/**
 * Build sequelize options from environment
 * @param {DialectType}  dialect
 * @returns {Options}
 */
export const buildSequelizeOptions = (dialect: DialectType): Options => {
    let sequelizeOptions: Options = {
        dialect: dialect,
        ...process.env.TEST_DB_HOST && { host: process.env.TEST_DB_HOST },
        ...process.env.TEST_DB_PORT && { port: parseInt(process.env.TEST_DB_PORT) },
        ...process.env.TEST_DB_DATABASE && { database: process.env.TEST_DB_DATABASE },
        ...process.env.TEST_DB_USERNAME && { username: process.env.TEST_DB_USERNAME },
        ...process.env.TEST_DB_PASSWORD && { password: process.env.TEST_DB_PASSWORD },
        dialectOptions: {
            decimalNumbers: true,
        },
        // logging: false,
    };

    return sequelizeOptions;
};
