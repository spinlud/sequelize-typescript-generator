import { DataType } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

export interface IMetadataOptions {
    schemaName: string;
    underscored?: boolean;
}

export interface ITableMetadata {
    name: string;
    columns: IColumnMetadata[];
}

export interface IColumnMetadata {
    name: string;
    type: string;
    typeExt: string;
    // dataType: DataType;
    primaryKey: boolean;
    // foreignKey: boolean;
    nullable: boolean;
    // unique: boolean;
    autoIncrement: boolean;
    default?: DataType;
}

export abstract class Dialect {
    protected connection: Sequelize;

    protected constructor(connection: Sequelize) {
        this.connection = connection;
    }

    public abstract async getMetadata(options: IMetadataOptions): Promise<ITableMetadata[]>
}
