import { IndexType, IndexMethod, AbstractDataTypeConstructor } from 'sequelize';
import { IConfig } from '../config';

export interface ITableMetadata {
    name: string; // Table name
    modelName: string; // Model name
    timestamps?: boolean;
    columns: IColumnMetadata[];
    comment?: string;
}

export interface IColumnMetadata {
    name: string; // Model field name
    fieldName?: string; // Map to original table field name in case of a transformation
    type: string;
    typeExt: string;
    dataType: string;
    primaryKey: boolean;
    // foreignKey: boolean;
    allowNull: boolean;
    autoIncrement: boolean;
    unique: boolean;
    indices?: IIndexMetadata[],
    comment?: string;
    // default?: ;
}

export interface IIndexMetadata {
    name: string;
    using: IndexMethod;
    collation: string | null;
    seq: number;
    type?: IndexType;
    unique: boolean;
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
