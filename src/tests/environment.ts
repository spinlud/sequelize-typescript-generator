import path from 'path';
import { Options, Dialect as DialectType } from 'sequelize';

const checkTestEnv = () => {
    if (!process.env.TEST_DB_PORT) {
        throw new Error(`Missing env variable TEST_DB_PORT`);
    }

    if (!process.env.TEST_DB_DATABASE) {
        throw new Error(`Missing env variable TEST_DB_DATABASE`);
    }

    if (!process.env.TEST_DB_USERNAME) {
        throw new Error(`Missing env variable TEST_DB_USERNAME`);
    }

    if (!process.env.TEST_DB_PASSWORD) {
        throw new Error(`Missing env variable TEST_DB_PASSWORD`);
    }
}

/**
 * Build sequelize options from environment
 * @param {DialectType}  dialect
 * @returns {Options}
 */
export const buildSequelizeOptions = (dialect: DialectType): Options => {
    checkTestEnv();

    let sequelizeOptions: Options = {
        dialect: dialect,
        host: process.env.TEST_DB_HOST ?? 'localhost',
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
