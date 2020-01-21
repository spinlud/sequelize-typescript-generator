import { AbstractDataTypeConstructor } from 'sequelize';
import { IConfig } from '../config';

export interface ITableMetadata {
    name: string;
    timestamps?: boolean;
    columns: IColumnMetadata[];
    comment?: string;
}

export interface IIndexMetadata {
    name: string;
    collation: string | null;
    seq: number;
    type: string;
    unique: boolean;
}

export interface IColumnMetadata {
    name: string;
    type: string;
    typeExt: string;
    dataType: string;
    // enumValues?: string[],
    primaryKey: boolean;
    // foreignKey: boolean;
    allowNull: boolean;
    autoIncrement: boolean;
    unique: boolean;
    indices?: IIndexMetadata[],
    // default?: ;
}

export abstract class Dialect {

    /**
     * Accepted dialects
     */
    public static dialects: Set<string> = new Set([
        'postgres',
        'mysql',
        'mariadb',
        'sqlite',
        'mssql',
    ]);

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
     * @param {IConfig} config
     * @returns {Promise<ITableMetadata[]>}
     */
    public abstract async fetchMetadata(config: IConfig): Promise<ITableMetadata[]>
}
