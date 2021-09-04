import { QueryTypes, AbstractDataTypeConstructor, IndexMethod } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { IConfig } from '../config';
import { IColumnMetadata, Dialect, IIndexMetadata, ITable } from './Dialect';
import { warnUnknownMappingForDataType } from './utils';

interface ITableRow {
    table_name: string;
    table_comment?: string;
}

interface IColumnMetadataSQLite {
    cid: number;
    dflt_value: any;
    name: string;
    notnull: number;
    pk: number;
    type: string;
}

interface IIndexMetadataSQLite {
    column_id: number,
    column_name: string,
    index_name: string,
    is_unique: number,
    origin: string,
    partial: number,
    seq: number,
    seq_number: number,
}

/**
 * Dialect for SQLite
 * @class DialectSQLite
 */
export class DialectSQLite extends Dialect {

    constructor() {
        super('sqlite');
    }

    /**
     * Map database data type to sequelize data type
     * @param {string} dbType
     * @returns {string}
     */
    public mapDbTypeToSequelize(dbType: string): AbstractDataTypeConstructor {
        // Affinity rules from https://www.sqlite.org/datatype3.html
        const dbTypeUpper = dbType.toUpperCase();

        if (dbTypeUpper.includes('INT')) {
            return DataType.INTEGER;
        }
        else if (dbTypeUpper.includes('CHAR') || dbTypeUpper.includes('CLOB') || dbTypeUpper.includes('TEXT')) {
            return DataType.STRING;
        }
        else if (dbTypeUpper.includes('BLOB')) {
            return DataType.BLOB;
        }
        else if (dbTypeUpper.includes('REAL') || dbTypeUpper.includes('FLOA') || dbTypeUpper.includes('DOUB')) {
            return DataType.REAL;
        }
        else {
            return DataType.DECIMAL;
        }
    }

    /**
     * Map database data type to javascript data type
     * @param {string} dbType
     * @returns {string
     */
    public mapDbTypeToJs(dbType: string): string {
        // Affinity rules from https://www.sqlite.org/datatype3.html
        const dbTypeUpper = dbType.toUpperCase();

        if (dbTypeUpper.includes('INT')) {
            return 'number';
        }
        else if (dbTypeUpper.includes('CHAR') || dbTypeUpper.includes('CLOB') || dbTypeUpper.includes('TEXT')) {
            return 'string';
        }
        else if (dbTypeUpper.includes('BLOB')) {
            return 'Uint8Array';
        }
        else {
            return 'number';
        }
    }

    /**
     * Map database default values to Sequelize type (e.g. uuid() => DataType.UUIDV4).
     * @param {string} v
     * @returns {string}
     */
    public mapDefaultValueToSequelize(v: string): string {
        return v;
    }

    /**
     * Fetch table names for the provided database/schema
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @returns {Promise<ITable[]>}
     */
    protected async fetchTables(
        connection: Sequelize,
        config: IConfig
    ): Promise<ITable[]> {
        const query = `
            SELECT 
                name    AS table_name
            FROM sqlite_master
            WHERE type ='table' AND name NOT LIKE 'sqlite_%';
        `;

        const tables: ITable[] = (await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as ITableRow[]).map(({ table_name, table_comment }) => {
            const t: ITable = {
                name: table_name,
                comment: table_comment ?? undefined,
            };

            return t;
        });

        return tables;
    }

    protected async fetchColumnsMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string
    ): Promise<IColumnMetadata[]> {
        const columnsMetadata: IColumnMetadata[] = [];

        const query = `PRAGMA main.table_info('${table}')`;

        const columns = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IColumnMetadataSQLite[];

        for (const column of columns) {
            // Unknown data type
            if (!this.mapDbTypeToSequelize(column.type)) {
                warnUnknownMappingForDataType(column.type);
            }

            const columnMetadata: IColumnMetadata = {
                name: column.name,
                originName: column.name,
                type: column.type,
                typeExt: column.type,
                ...this.mapDbTypeToSequelize(column.type) && {
                    dataType: 'DataType.' +
                        this.mapDbTypeToSequelize(column.type).key
                            .split(' ')[0], // avoids 'DOUBLE PRECISION' key to include PRECISION in the mapping
                },
                allowNull: !!column.notnull,
                primaryKey: !!column.pk,
                autoIncrement: !!column.pk,
                indices: [],
                comment: '', // TODO
            };

            columnsMetadata.push(columnMetadata);
        }

        return columnsMetadata;
    }

    protected async fetchColumnIndexMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string,
        column: string
    ): Promise<IIndexMetadata[]> {
        const indicesMetadata: IIndexMetadata[] = [];

        const query = `
            SELECT
                   il.seq,
                   ii.seqno AS seq_number,
                   ii.cid AS column_id,
                   ii.name as column_name,
                   il.name AS index_name,
                   il.\`unique\` AS is_unique,
                   il.origin,
                   il.partial
            FROM sqlite_master AS m,
                   pragma_index_list(m.name) AS il,
                   pragma_index_info(il.name) AS ii
            WHERE m.type = 'table' AND m.name = '${table}' AND ii.name = '${column}'
            ORDER BY il.seq;
        `;

        const indices = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IIndexMetadataSQLite[];

        for (const index of indices) {
            indicesMetadata.push({
                name: index.index_name,
                seq: index.seq_number,
                unique: !!index.is_unique,
            });
        }

        return indicesMetadata;
    }

}
