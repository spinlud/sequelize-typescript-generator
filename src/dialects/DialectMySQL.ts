import {QueryTypes, AbstractDataTypeConstructor, IndexMethod} from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { IConfig } from '../config';
import { IColumnMetadata, Dialect, IIndexMetadata } from './Dialect';

interface ITableNameRow {
    table_name?: string;
    TABLE_NAME?: string;
}

interface IColumnMetadataMySQL {
    TABLE_CATALOG: string;
    TABLE_SCHEMA: string;
    TABLE_NAME: string;
    COLUMN_NAME: string;
    ORDINAL_POSITION?: number;
    COLUMN_DEFAULT?: string;
    IS_NULLABLE: string;
    DATA_TYPE: string;
    CHARACTER_MAXIMUM_LENGTH?: string;
    CHARACTER_OCTET_LENGTH?: string;
    NUMERIC_PRECISION?: number;
    NUMERIC_SCALE?: number;
    DATETIME_PRECISION?: string;
    CHARACTER_SET_NAME?: string;
    COLLATION_NAME?: string;
    COLUMN_TYPE: string;
    COLUMN_KEY: string;
    EXTRA: string;
    PRIVILEGES: string;
    COLUMN_COMMENT: string;
    TABLE_COMMENT: string;
    GENERATION_EXPRESSION: string;
}

interface IIndexMetadataMySQL {
    INDEX_NAME: string; // The name of the index. If the index is the primary key, the name is always PRIMARY.
    NON_UNIQUE: number | null; // 0 if the index cannot contain duplicates, 1 if it can
    INDEX_SCHEMA: string | null; // The name of the schema (database) to which the index belongs.
    SEQ_IN_INDEX: number | null; // The column sequence number in the index, starting with 1.
    COLLATION: string | null; // How the column is sorted in the index. This can have values A (ascending), D (descending), or NULL (not sorted).
    CARDINALITY: number | null; // An estimate of the number of unique values in the index.
    SUB_PART: string | null; // The index prefix. That is, the number of indexed characters if the column is only partly indexed, NULL if the entire column is indexed.
    PACKED: string | null;// Indicates how the key is packed. NULL if it is not.
    NULLABLE: string | null; // Contains YES if the column may contain NULL values and '' if not.
    INDEX_TYPE: IndexMethod | null; // The index method used (BTREE, FULLTEXT, HASH, RTREE).
    COMMENT: string | null;
    INDEX_COMMENT: string | null;
}

/**
 * Compute precision/scale signature for numeric types: FLOAT(4, 2), DECIMAL(5, 2) etc
 * @param {IColumnMetadataMySQL} columnMetadataMySQL
 * @returns {string} '(5, 2)'
 */
const numericPrecisionScaleMySQL = (columnMetadataMySQL: IColumnMetadataMySQL): string => {
    let res = `(${columnMetadataMySQL.NUMERIC_PRECISION}`;
    res +=  columnMetadataMySQL.NUMERIC_SCALE ?
        `, ${columnMetadataMySQL.NUMERIC_SCALE})` : `)`;
    return res;
};

/**
 * Compute date time precision signature: TIMESTAMP(3), DATETIME(6)
 * @param {IColumnMetadataMySQL} columnMetadataMySQL
 * @returns {string} '(3)'
 */
const dateTimePrecisionMySQL = (columnMetadataMySQL: IColumnMetadataMySQL): string => {
    if (columnMetadataMySQL.DATETIME_PRECISION) {
        return `(${columnMetadataMySQL.DATETIME_PRECISION})`;
    }
    else {
        return '';
    }
};

/**
 * Dialect for MySQL
 * @class DialectMySQL
 */
export class DialectMySQL extends Dialect {

    public readonly sequelizeDataTypesMap: { [key: string]: AbstractDataTypeConstructor } = {
        bigint: DataType.BIGINT,
        int: DataType.INTEGER,
        smallint: DataType.SMALLINT,
        mediumint: DataType.MEDIUMINT,
        tinyint: DataType.TINYINT,
        decimal: DataType.DECIMAL,
        float: DataType.FLOAT,
        double: DataType.DOUBLE,

        bit: DataType.INTEGER,

        varchar: DataType.STRING,
        char: DataType.CHAR,
        text: DataType.STRING,
        tinytext: DataType.STRING,
        mediumtext: DataType.STRING,
        longtext: DataType.STRING,

        date: DataType.DATEONLY,
        datetime: DataType.DATE,
        time: DataType.TIME,
        timestamp: DataType.DATE,
        year: DataType.INTEGER,

        enum: DataType.ENUM,
        set: DataType.STRING,

        binary: DataType.BLOB,
        blob: DataType.BLOB,
        tinyblob: DataType.BLOB,
        mediumblob: DataType.BLOB,
        longblob: DataType.BLOB,

        point: DataType.GEOMETRY,
        multipoint: DataType.GEOMETRY,
        linestring: DataType.GEOMETRY,
        multilinestring: DataType.GEOMETRY,
        polygon: DataType.GEOMETRY,
        multipolygon: DataType.GEOMETRY,
        geometry: DataType.GEOMETRY,
        geometrycollection: DataType.GEOMETRY,

        json: DataType.JSON,
    };

    public readonly jsDataTypesMap: { [key: string]: string } = {
        bigint: 'number',
        smallint: 'number',
        mediumint: 'number',
        tinyint: 'number',
        decimal: 'string',
        float: 'number',
        double: 'number',
        int: 'number',

        bit: 'Uint8Array',

        varchar: 'string',
        char: 'string',
        mediumtext: 'string',
        tinytext: 'string',
        longtext: 'string',
        text: 'string',

        date: 'string',
        time: 'string',
        datetime: 'Date',
        timestamp: 'Date',
        year: 'number',

        enum: 'string',
        set: 'string',

        binary: 'Uint8Array',
        blob: 'Uint8Array',
        tinyblob: 'Uint8Array',
        mediumblob: 'Uint8Array',
        longblob: 'Uint8Array',

        point: 'object',
        multipoint: 'object',
        linestring: 'object',
        multilinestring: 'object',
        polygon: 'object',
        multipolygon: 'object',
        geometry: 'object',
        geometrycollection: 'object',

        json: 'object',
    }

    /**
     * Fetch table names for the provided database/schema
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @returns {Promise<string[]>}
     */
    protected async fetchTableNames(
        connection: Sequelize,
        config: IConfig
    ): Promise<string[]> {
        const query = `
            SELECT table_name 
            FROM information_schema.tables
            WHERE table_schema = '${config.connection.database}';
        `;

        const tableNames: string[] = (await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as ITableNameRow[]).map(row => row.table_name ?? row.TABLE_NAME!);

        return tableNames;
    }

    /**
     * Fetch columns metadata for the provided schema and table
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {string} table
     * @returns {Promise<IColumnMetadata[]>}
     */
    protected async fetchColumnsMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string
    ): Promise<IColumnMetadata[]> {
        const columnsMetadata: IColumnMetadata[] = [];

        const query = `
            SELECT 
                c.ORDINAL_POSITION,
                c.TABLE_SCHEMA,
                c.TABLE_NAME,
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.COLUMN_TYPE,
                c.NUMERIC_PRECISION,
                c.NUMERIC_SCALE,
                c.DATETIME_PRECISION,                                             
                c.IS_NULLABLE,
                c.COLUMN_KEY,
                c.EXTRA,
                c.COLUMN_COMMENT,
                t.TABLE_COMMENT                        
            FROM information_schema.columns c
            INNER JOIN information_schema.tables t
                ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME                    
            WHERE c.TABLE_SCHEMA='${config.connection.database}' AND c.TABLE_NAME = '${table}'
            ORDER BY c.ORDINAL_POSITION;            
        `;

        const columns = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IColumnMetadataMySQL[];

        for (const column of columns) {
            // Data type not recognized
            if (!this.sequelizeDataTypesMap[column.DATA_TYPE]) {
                console.warn(`[Warning]`,
                    `Unknown data type mapping for '${column.DATA_TYPE}'`);
                console.warn(`[Warning]`,
                    `Skipping column`, column);
                continue;
            }

            const columnMetadata: IColumnMetadata = {
                name: column.COLUMN_NAME,
                type: column.DATA_TYPE,
                typeExt: column.COLUMN_TYPE,
                dataType: 'DataType.' +
                    this.sequelizeDataTypesMap[column.DATA_TYPE].key
                        .split(' ')[0], // avoids 'DOUBLE PRECISION' key to include PRECISION in the mapping
                allowNull: column.IS_NULLABLE === 'YES',
                primaryKey: column.COLUMN_KEY === 'PRI',
                autoIncrement: column.EXTRA === 'auto_increment',
                indices: [],
                comment: column.COLUMN_COMMENT,
            };

            // Additional data type informations
            switch (column.DATA_TYPE) {
                case 'decimal':
                case 'numeric':
                case 'float':
                case 'double':
                    columnMetadata.dataType += numericPrecisionScaleMySQL(column);
                    break;

                case 'datetime':
                case 'timestamp':
                    columnMetadata.dataType += dateTimePrecisionMySQL(column);
                    break;
            }

            // ENUM: add values to data type -> DataType.ENUM('v1', 'v2')
            if (column.DATA_TYPE === 'enum') {
                columnMetadata.dataType += columnMetadata.typeExt.match(/\(.*\)/)![0];
            }

            columnsMetadata.push(columnMetadata);
        }

        return columnsMetadata;
    }

    /**
     * Fetch index metadata for the provided table and column
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {string} table
     * @param {string} column
     * @returns {Promise<IIndexMetadata[]>}
     */
    protected async fetchColumnIndexMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string,
        column: string
    ): Promise<IIndexMetadata[]> {
        const indicesMetadata: IIndexMetadata[] = [];

        const query = `
            SELECT *                
            FROM information_schema.statistics s
            WHERE TABLE_SCHEMA = '${config.connection.database}' AND TABLE_NAME = '${table}' 
                AND COLUMN_NAME = '${column}';
        `;

        const indices = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IIndexMetadataMySQL[];

        for (const index of indices) {
            indicesMetadata.push({
                name: index.INDEX_NAME!,
                using: index.INDEX_TYPE!,
                collation: index.COLLATION,
                seq: index.SEQ_IN_INDEX!,
                unique: index.NON_UNIQUE === 0,
            });
        }

        return indicesMetadata;
    }
}
