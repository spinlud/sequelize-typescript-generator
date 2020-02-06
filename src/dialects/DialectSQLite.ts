import { QueryTypes, AbstractDataTypeConstructor, IndexMethod } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { IConfig } from '../config';
import { IColumnMetadata, Dialect, IIndexMetadata } from './Dialect';
import { warnUnknownMappingForDataType } from './utils';

/**
 * Dialect for SQLite
 * @class DialectSQLite
 */
export class DialectSQLite extends Dialect {
    readonly jsDataTypesMap: { [p: string]: string };
    readonly sequelizeDataTypesMap: { [p: string]: AbstractDataTypeConstructor };

    protected async fetchTableNames(connection: Sequelize, config: IConfig): Promise<string[]> {
        return [];
    }

    protected async fetchColumnsMetadata(connection: Sequelize, config: IConfig, table: string): Promise<IColumnMetadata[]> {
        const query = `PRAGMA main.table_info('${table}')`;

        return [];
    }

    protected async fetchColumnIndexMetadata(connection: Sequelize, config: IConfig, table: string, column: string): Promise<IIndexMetadata[]> {
        const query = `PRAGMA main.index_list('${table}')`;

        return [];
    }

}
