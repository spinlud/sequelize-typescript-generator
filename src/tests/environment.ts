import { Options, Dialect as DialectType } from 'sequelize';

const setEnv = (): void => {
    if (!process.env['TEST_DB_HOST']) {
        process.env['TEST_DB_HOST'] = 'localhost';
    }

    if (!process.env['TEST_DB_PORT']) {
        process.env['TEST_DB_PORT'] = '1234';
    }

    if (!process.env['TEST_DB_DATABASE']) {
        process.env['TEST_DB_DATABASE'] = 'testdb';
    }

    if (!process.env['TEST_DB_USERNAME']) {
        process.env['TEST_DB_USERNAME'] = 'sa';
    }

    if (!process.env['TEST_DB_PASSWORD']) {
        process.env['TEST_DB_PASSWORD'] = 'Passw0rd88!';
    }
}

/**
 * Build sequelize options from environment
 * @param {DialectType}  dialect
 * @returns {Options}
 */
export const buildSequelizeOptions = (dialect: DialectType): Options => {
    setEnv();

    let sequelizeOptions: Options = {
        dialect: dialect,
        host: process.env.TEST_DB_HOST,
        port: parseInt(process.env.TEST_DB_PORT!),
        database: process.env.TEST_DB_DATABASE,
        username: process.env.TEST_DB_USERNAME,
        password: process.env.TEST_DB_PASSWORD,
        logQueryParameters: true,
        logging: true,

        ...dialect === 'mariadb' && { dialectOptions: {
                timezone: 'Etc/GMT-3',
            }
        },

        ...dialect === 'sqlite' && {
            storage: 'memory',
        }
    };

    return sequelizeOptions;
};
