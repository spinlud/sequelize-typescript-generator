import { Options } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

/**
 * Create a new sequelize connection
 * @param {Options} options
 * @returns {Sequelize}
 */
export const createConnection = (options: Options): Sequelize => {
    return new Sequelize(options);
};
