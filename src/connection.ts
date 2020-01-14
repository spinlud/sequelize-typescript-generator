import { Sequelize } from 'sequelize-typescript';
import { Options } from 'sequelize';

export function createSequelize(options: Options): Sequelize {
    return new Sequelize(options);
}
