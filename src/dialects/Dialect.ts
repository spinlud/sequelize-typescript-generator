import { Sequelize } from 'sequelize-typescript';
import { AbstractDataTypeConstructor } from 'sequelize';
import { ITableMetadata } from './';

export interface IDialectOptions {
    schemaName: string; // Database schema from which to retrieve tables
    tables?: string[]; // List of tables to import
    skipTables?: string[]; // List of tables to skip
    underscored?: boolean;
    camelCased?: boolean;
}

export abstract class Dialect {
    protected connection: Sequelize;
    protected options: IDialectOptions;

    protected constructor(connection: Sequelize, options: IDialectOptions) {
        this.connection = connection;
        this.options = options;
    }

    /**
     * Maps dialect data type to sequelize data type
     */
    public abstract readonly sequelizeDataTypesMap: { [key: string]: AbstractDataTypeConstructor };

    /**
     * Maps dialect type to javascript type
     */
    public abstract readonly jsDataTypesMap: { [key: string]: string };

    /**
     * Extract tables metadata for the specific dialect and schema
     * @returns {Promise<ITableMetadata[]>}
     */
    public abstract async getMetadata(): Promise<ITableMetadata[]>
}
