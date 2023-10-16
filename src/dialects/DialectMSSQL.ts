import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { IConfig } from '../config';
import { IColumnMetadata, IIndexMetadata, Dialect, ITable } from './Dialect';
import { generatePrecisionSignature, warnUnknownMappingForDataType } from './utils';

interface ITableRow {
    table_name: string;
    table_comment?: string;
}

interface IColumnMetadataMSSQL {
    CHARACTER_MAXIMUM_LENGTH: number | null;
    CHARACTER_OCTET_LENGTH: number | null;
    CHARACTER_SET_CATALOG: string ;
    CHARACTER_SET_NAME: string | null;
    CHARACTER_SET_SCHEMA: string | null;
    COLLATION_CATALOG: string | null;
    COLLATION_NAME: string | null;
    COLLATION_SCHEMA: string | null;
    COLUMN_DEFAULT: string | null;
    COLUMN_NAME: string;
    CONSTRAINT_NAME: string | null;
    CONSTRAINT_TYPE: string | null;
    DATA_TYPE: string;
    DATETIME_PRECISION: number | null;
    DOMAIN_CATALOG: string | null;
    DOMAIN_NAME: string | null;
    DOMAIN_SCHEMA: string | null;
    IS_NULLABLE: string;
    IS_IDENTITY: string;
    NUMERIC_PRECISION: number | null;
    NUMERIC_PRECISION_RADIX: number | null;
    NUMERIC_SCALE: number | null;
    ORDINAL_POSITION: number;
    TABLE_CATALOG: string;
    TABLE_NAME: string;
    TABLE_SCHEMA: string;
    COLUMN_COMMENT: string | null;
}

interface IIndexMetadataMSSQL {
    column_id: number;
    ColumnName: string;
    data_space_id: number;
    ignore_dup_key: string;
    index_id: number;
    IndexName: string;
    is_included_column: boolean;
    is_primary_key: boolean;
    is_unique: boolean;
    is_unique_constraint: boolean;
    TableName: string;
    type: number;
    type_desc: string;
}

const jsDataTypesMap: { [key: string]: string } = {
    int: 'number',
    bigint: 'string',
    tinyint: 'number',
    smallint: 'number',
    numeric: 'number',
    decimal: 'number',
    float: 'number',
    real: 'number',
    money: 'number',
    smallmoney: 'number',
    char: 'string',
    nchar: 'string',
    varchar: 'string',
    nvarchar: 'string',
    text: 'string',
    ntext: 'string',
    date: 'string',
    datetime: 'Date',
    datetime2: 'Date',
    timestamp: 'Date',
    datetimeoffset: 'Date',
    time: 'Date',
    smalldatetime: 'string',
    bit: 'boolean',
    binary: 'Uint8Array',
    varbinary: 'Uint8Array',
    uniqueidentifier: 'string',
    xml: 'string',
    geography: 'object',
};

const sequelizeDataTypesMap: { [key: string]: AbstractDataTypeConstructor } = {
    int: DataType.INTEGER,
    bigint: DataType.BIGINT,
    tinyint: DataType.INTEGER,
    smallint: DataType.INTEGER,
    numeric: DataType.DECIMAL,
    decimal: DataType.DECIMAL,
    float: DataType.FLOAT,
    real: DataType.REAL,
    money: DataType.STRING,
    smallmoney: DataType.STRING,
    char: DataType.STRING,
    nchar: DataType.STRING,
    varchar: DataType.STRING,
    nvarchar: DataType.STRING,
    text: DataType.STRING,
    ntext: DataType.STRING,
    date: DataType.DATEONLY,
    datetime: DataType.DATE,
    datetime2: DataType.DATE,
    timestamp: DataType.DATE,
    datetimeoffset: DataType.STRING,
    time: DataType.TIME,
    smalldatetime: DataType.DATE,
    bit: DataType.STRING,
    binary: DataType.STRING,
    varbinary: DataType.STRING,
    uniqueidentifier: DataType.STRING,
    xml: DataType.STRING,
    geography: DataType.GEOGRAPHY,
};

/**
 * Dialect for Postgres
 * @class DialectPostgres
 */
export class DialectMSSQL extends Dialect {

    constructor() {
        super('mssql');
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
     * @returns {string
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
                t.name               AS [table_name],
                td.value             AS [table_comment]
            FROM sysobjects t
            INNER JOIN sysusers u
                ON u.uid = t.uid
            LEFT OUTER JOIN sys.extended_properties td
                ON td.major_id = t.id AND td.minor_id = 0 AND td.name = 'MS_Description'
            WHERE t.type = 'u';
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
                c.*,
                CASE WHEN COLUMNPROPERTY(object_id(c.TABLE_SCHEMA +'.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') = 1 THEN 'YES' ELSE 'NO' END AS IS_IDENTITY, 
                tc.CONSTRAINT_NAME, 
                tc.CONSTRAINT_TYPE,
                ep.value                AS [COLUMN_COMMENT]               
            FROM information_schema.columns c
            LEFT OUTER JOIN information_schema.key_column_usage ku
                 ON c.TABLE_CATALOG = ku.TABLE_CATALOG AND c.TABLE_NAME = ku.TABLE_NAME AND
                    c.COLUMN_NAME = ku.COLUMN_NAME
            LEFT OUTER JOIN information_schema.table_constraints tc
                 ON c.TABLE_CATALOG = tc.TABLE_CATALOG AND c.TABLE_NAME = tc.TABLE_NAME AND
                    ku.CONSTRAINT_CATALOG = tc.CONSTRAINT_CATALOG AND ku.CONSTRAINT_NAME = tc.CONSTRAINT_NAME                    
            INNER JOIN sysobjects t
                ON c.TABLE_NAME = t.name AND t.type = 'u'
            INNER JOIN syscolumns sc
                ON sc.id = t.id AND sc.name = c.COLUMN_NAME
            LEFT OUTER JOIN sys.extended_properties ep
                 ON ep.major_id = sc.id AND ep.minor_id = sc.colid AND ep.name = 'MS_Description'                                        
            WHERE c.TABLE_CATALOG = N'${config.connection.database}' AND c.TABLE_NAME = N'${table}'
            ORDER BY c.ORDINAL_POSITION;
        `;

        const columns = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IColumnMetadataMSSQL[];

        for (const column of columns) {
            // Unknown data type
            if (!this.mapDbTypeToSequelize(column.DATA_TYPE)) {
                warnUnknownMappingForDataType(column.DATA_TYPE);
            }

            const columnMetadata: IColumnMetadata = {
                name: column.COLUMN_NAME,
                originName: column.COLUMN_NAME,
                type: column.DATA_TYPE,
                typeExt: column.DATA_TYPE,
                ...this.mapDbTypeToSequelize(column.DATA_TYPE) && {
                    dataType: 'DataType.' +
                        this.mapDbTypeToSequelize(column.DATA_TYPE).key
                            .split(' ')[0], // avoids 'DOUBLE PRECISION' key to include PRECISION in the mapping
                },
                allowNull: column.IS_NULLABLE.toUpperCase() === 'YES' &&
                    column.CONSTRAINT_TYPE?.toUpperCase() !== 'PRIMARY KEY',
                primaryKey: column.CONSTRAINT_TYPE?.toUpperCase() === 'PRIMARY KEY',
                autoIncrement: column.IS_IDENTITY === 'YES',
                indices: [],
                comment: column.COLUMN_COMMENT ?? undefined,
            };

            // Additional data type information
            switch (column.DATA_TYPE) {
                case 'decimal':
                case 'numeric':
                case 'float':
                case 'double':
                    columnMetadata.dataType +=
                        generatePrecisionSignature(column.NUMERIC_PRECISION, column.NUMERIC_SCALE);
                    break;

                case 'datetime2':
                    columnMetadata.dataType += generatePrecisionSignature(column.DATETIME_PRECISION);
                    break;

                case 'char':
                case 'nchar':
                case 'varchar':
                case 'nvarchar':
                    columnMetadata.dataType += generatePrecisionSignature(column.CHARACTER_MAXIMUM_LENGTH);
                    break;
            }

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
                   c.column_id,
                   OBJECT_NAME(i.[object_id]) TableName,
                   i.name                   IndexName,
                   c.name                   ColumnName,
                   ic.is_included_column,
                   i.index_id,
                   i.is_unique,
                   i.data_space_id,
                   i.ignore_dup_key,
                   i.is_primary_key,
                   i.is_unique_constraint,
                   i.type,
                   i.type_desc
            FROM sys.indexes i
                JOIN sys.index_columns ic
                    ON ic.object_id = i.object_id AND i.index_id = ic.index_id
                JOIN sys.columns c
                    ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                JOIN sys.tables t
                    ON t.object_id = c.object_id
            WHERE t.object_id = object_id(N'${table}') AND c.name=N'${column}'
            ORDER BY ic.column_id;
        `;

        const indices = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IIndexMetadataMSSQL[];

        for (const index of indices) {
            indicesMetadata.push({
                name: index.IndexName,
                unique: index.is_unique,
            });
        }

        return indicesMetadata;
    }

}
