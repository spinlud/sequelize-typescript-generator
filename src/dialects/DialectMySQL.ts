import {QueryTypes, AbstractDataTypeConstructor, IndexMethod, col} from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { IConfig } from '../config';
import { IColumnMetadata, Dialect, IIndexMetadata, ITable } from './Dialect';
import { warnUnknownMappingForDataType, generatePrecisionSignature } from './utils';

interface ITableRow {
    table_name: string;
    table_comment?: string;
}

interface IColumnMetadataMySQL {
    TABLE_CATALOG: string;
    TABLE_SCHEMA: string;
    TABLE_NAME: string;
    COLUMN_NAME: string;
    ORDINAL_POSITION?: number;
    IS_NULLABLE: string;
    DATA_TYPE: string;
    CHARACTER_MAXIMUM_LENGTH: number;
    CHARACTER_OCTET_LENGTH?: string;
    NUMERIC_PRECISION?: number;
    NUMERIC_SCALE?: number;
    DATETIME_PRECISION?: string;
    CHARACTER_SET_NAME?: string;
    COLLATION_NAME?: string;
    COLUMN_TYPE: string;
    COLUMN_KEY: string;
    EXTRA: string;
    COLUMN_DEFAULT: null | string;
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

const sequelizeDataTypesMap: { [key: string]: AbstractDataTypeConstructor } = {
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

const jsDataTypesMap: { [key: string]: string } = {
    bigint: 'number',
    smallint: 'number',
    mediumint: 'number',
    tinyint: 'number',
    decimal: 'string',
    float: 'number',
    double: 'number',
    int: 'number',
    bit: 'number',
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
};

const defaultValuesMap: { [key: string]: string } = {
    'uuid()': 'DataType.UUIDV4',
    'CURRENT_TIMESTAMP': 'DataType.NOW',
};

const getDefaultValue = (columnDefault: string | null): any => {
    if (!columnDefault) {
        return null;
    }

    // Check if it is MySQL binary representation (e.g. b'100')
    const regex = new RegExp(/b\'([01]+)\'/g);
    const binaryStringCheck = regex.exec(columnDefault);

    if (binaryStringCheck) {
        const parsed = parseInt(binaryStringCheck[1], 2);

        if (parsed !== null) {
            return parsed;
        }
    }

    return columnDefault;
}

/**
 * Dialect for MySQL
 * @class DialectMySQL
 */
export class DialectMySQL extends Dialect {

    constructor() {
        super('mysql');
    }

    /**
     * Map database data type to sequelize data type
     * @param {string} dbType
     * @returns {string}
     */
    public mapDbTypeToSequelize(dbType: string): AbstractDataTypeConstructor {
        return sequelizeDataTypesMap[dbType];
    }

    /**
     * Map database data type to javascript data type
     * @param {string} dbType
     * @returns {string}
     */
    public mapDbTypeToJs(dbType: string): string {
        return jsDataTypesMap[dbType];
    }

    /**
     * Map database default values to Sequelize type (e.g. uuid() => DataType.UUIDV4).
     * @param {string} v
     * @returns {string}
     */
    public mapDefaultValueToSequelize(v: string): string {
        return defaultValuesMap.hasOwnProperty(v) ? defaultValuesMap[v] : v;
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
                table_name      AS table_name, 
                table_comment   AS table_comment 
            FROM information_schema.tables
            WHERE table_schema = '${config.connection.database}' 
                ${config.metadata?.noViews ? 'AND table_type <> \'VIEW\'' : ''};
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
                c.CHARACTER_MAXIMUM_LENGTH,
                c.NUMERIC_PRECISION,
                c.NUMERIC_SCALE,
                c.DATETIME_PRECISION,                                             
                c.IS_NULLABLE,
                c.COLUMN_KEY,
                c.EXTRA,
                c.COLUMN_DEFAULT,
                c.COLUMN_COMMENT,
                t.TABLE_COMMENT                        
            FROM information_schema.columns c
            INNER JOIN information_schema.tables t
                ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME                    
            WHERE c.TABLE_SCHEMA = '${config.connection.database}' AND c.TABLE_NAME = '${table}'
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
            // Unknown data type
            if (!this.mapDbTypeToSequelize(column.DATA_TYPE)) {
                warnUnknownMappingForDataType(column.DATA_TYPE);
            }

            const columnMetadata: IColumnMetadata = {
                name: column.COLUMN_NAME,
                originName: column.COLUMN_NAME,
                type: column.DATA_TYPE,
                typeExt: column.COLUMN_TYPE,
                ...this.mapDbTypeToSequelize(column.DATA_TYPE) && {
                    dataType: 'DataType.' +
                        this.mapDbTypeToSequelize(column.DATA_TYPE).key
                            .split(' ')[0], // avoids 'DOUBLE PRECISION' key to include PRECISION in the mapping
                },
                allowNull: column.IS_NULLABLE === 'YES',
                primaryKey: column.COLUMN_KEY === 'PRI',
                autoIncrement: column.EXTRA === 'auto_increment',
                indices: [],
                comment: column.COLUMN_COMMENT,
                ...column.COLUMN_DEFAULT && { defaultValue: getDefaultValue(column.COLUMN_DEFAULT) },
            };

            // Additional data type informations
            switch (column.DATA_TYPE) {
                case 'decimal':
                case 'numeric':
                case 'float':
                case 'double':
                    columnMetadata.dataType +=
                        generatePrecisionSignature(column.NUMERIC_PRECISION, column.NUMERIC_SCALE);
                    break;

                case 'datetime':
                case 'timestamp':
                    columnMetadata.dataType += generatePrecisionSignature(column.DATETIME_PRECISION);
                    break;

                case 'char':
                case 'varchar':
                    columnMetadata.dataType += generatePrecisionSignature(column.CHARACTER_MAXIMUM_LENGTH);
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
