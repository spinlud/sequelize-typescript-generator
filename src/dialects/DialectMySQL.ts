import {QueryTypes, AbstractDataTypeConstructor, IndexMethod, col} from 'sequelize';
import { Sequelize, DataTypes } from 'sequelize';
import { IConfig } from '../config/index.js';
import { IColumnMetadata, Dialect, IIndexMetadata, IForeignKeyConstraintMetadata, ITable } from './Dialect.js';
import { warnUnknownMappingForDataType } from './utils.js';
import {
    buildSequelizeDataType,
    renderDataTypeExpression,
    parseEnumValues,
    DATA_TYPE_NAMESPACES,
    DataTypeArgument,
} from './dataTypes.js';
import {
    groupForeignKeyRows,
    buildInformationSchemaForeignKeysQuery,
    IForeignKeyColumnRow,
    IInformationSchemaForeignKeyRow,
} from './foreignKeys.js';

interface ITableRow {
    table_name: string;
    table_comment?: string;
    table_type?: string;
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
    bigint: DataTypes.BIGINT,
    int: DataTypes.INTEGER,
    smallint: DataTypes.SMALLINT,
    mediumint: DataTypes.MEDIUMINT,
    tinyint: DataTypes.TINYINT,
    decimal: DataTypes.DECIMAL,
    float: DataTypes.FLOAT,
    double: DataTypes.DOUBLE,
    bit: DataTypes.INTEGER,
    varchar: DataTypes.STRING,
    char: DataTypes.CHAR,
    text: DataTypes.STRING,
    tinytext: DataTypes.STRING,
    mediumtext: DataTypes.STRING,
    longtext: DataTypes.STRING,
    date: DataTypes.DATEONLY,
    datetime: DataTypes.DATE,
    time: DataTypes.TIME,
    timestamp: DataTypes.DATE,
    year: DataTypes.INTEGER,
    enum: DataTypes.ENUM,
    set: DataTypes.STRING,
    binary: DataTypes.BLOB,
    blob: DataTypes.BLOB,
    tinyblob: DataTypes.BLOB,
    mediumblob: DataTypes.BLOB,
    longblob: DataTypes.BLOB,
    point: DataTypes.GEOMETRY,
    multipoint: DataTypes.GEOMETRY,
    linestring: DataTypes.GEOMETRY,
    multilinestring: DataTypes.GEOMETRY,
    polygon: DataTypes.GEOMETRY,
    multipolygon: DataTypes.GEOMETRY,
    geometry: DataTypes.GEOMETRY,
    geometrycollection: DataTypes.GEOMETRY,
    json: DataTypes.JSON,
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
                table_comment   AS table_comment,
                table_type      AS table_type
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
        ) as ITableRow[]).map(({ table_name, table_comment, table_type }) => {
            const t: ITable = {
                name: table_name,
                comment: table_comment ?? undefined,
                isView: table_type === 'VIEW',
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

            const sequelizeConstructor = this.mapDbTypeToSequelize(column.DATA_TYPE);

            // Data type arguments (precision, length or ENUM values)
            let dataTypeArgs: Array<DataTypeArgument | null | undefined> = [];

            switch (column.DATA_TYPE) {
                case 'decimal':
                case 'numeric':
                case 'float':
                case 'double':
                    dataTypeArgs = [column.NUMERIC_PRECISION, column.NUMERIC_SCALE];
                    break;

                case 'datetime':
                case 'timestamp':
                    dataTypeArgs = [column.DATETIME_PRECISION];
                    break;

                case 'char':
                case 'varchar':
                    dataTypeArgs = [column.CHARACTER_MAXIMUM_LENGTH];
                    break;

                case 'enum':
                    dataTypeArgs = parseEnumValues(column.COLUMN_TYPE);
                    break;
            }

            const sequelizeType = sequelizeConstructor
                ? buildSequelizeDataType(sequelizeConstructor, dataTypeArgs)
                : undefined;

            const columnMetadata: IColumnMetadata = {
                name: column.COLUMN_NAME,
                originName: column.COLUMN_NAME,
                type: column.DATA_TYPE,
                typeExt: column.COLUMN_TYPE,
                ...sequelizeType && {
                    sequelizeType,
                    dataType: renderDataTypeExpression(sequelizeType, DATA_TYPE_NAMESPACES.decorators),
                },
                allowNull: column.IS_NULLABLE === 'YES',
                primaryKey: column.COLUMN_KEY === 'PRI',
                autoIncrement: column.EXTRA === 'auto_increment',
                indices: [],
                comment: column.COLUMN_COMMENT,
                ...column.COLUMN_DEFAULT && { defaultValue: getDefaultValue(column.COLUMN_DEFAULT) },
            };

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

    /**
     * Fetch foreign key constraints for the provided table. Constraints are read from
     * information_schema.referential_constraints joined to key_column_usage, and a
     * source column is flagged unique when it is covered by a single-column unique index.
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {ITable} table
     * @returns {Promise<IForeignKeyConstraintMetadata[]>}
     */
    protected async fetchForeignKeysMetadata(
        connection: Sequelize,
        config: IConfig,
        table: ITable
    ): Promise<IForeignKeyConstraintMetadata[]> {
        const foreignKeyRows = await connection.query<IInformationSchemaForeignKeyRow>(
            buildInformationSchemaForeignKeysQuery(config.connection.database, table.name),
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        const rows: IForeignKeyColumnRow[] = foreignKeyRows.map(row => ({
            constraintName: row.constraint_name,
            sourceTable: row.source_table,
            sourceColumn: row.source_column,
            targetSchema: row.target_schema,
            targetTable: row.target_table,
            targetColumn: row.target_column,
            ordinalPosition: row.ordinal_position,
            onDelete: row.on_delete,
            onUpdate: row.on_update,
            isSourceColumnUnique: Number(row.is_source_column_unique) === 1,
        }));

        return groupForeignKeyRows(rows);
    }
}
