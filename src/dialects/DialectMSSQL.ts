import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { IConfig } from '../config';
import { IColumnMetadata, IIndexMetadata, Dialect } from './Dialect';
import { warnUnknownMappingForDataType } from './utils';

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
    IS_NULLABLE: string | null;
    NUMERIC_PRECISION: number | null;
    NUMERIC_PRECISION_RADIX: number | null;
    NUMERIC_SCALE: number | null;
    ORDINAL_POSITION: number;
    TABLE_CATALOG: string;
    TABLE_NAME: string;
    TABLE_SCHEMA: string;
}

/**
 * Dialect for Postgres
 * @class DialectPostgres
 */
export class DialectMSSQL extends Dialect {

    readonly jsDataTypesMap: { [key: string]: string } = {
        int: 'number',
        bigint: 'number',
        tinyint: 'number',
        smallint: 'number',
        numeric: 'number',
        decimal: 'number',
        float: 'number',
        real: 'number',
        money: 'string',
        smallmoney: 'string',
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
        datetimeoffset: 'string',
        time: 'string',
        smalldatetime: 'string',
        bit: 'Uint8Array',
        binary: 'Uint8Array',
        varbinary: 'Uint8Array',
        uniqueidentifier: 'string',
        xml: 'string',
    }

    readonly sequelizeDataTypesMap: { [key: string]: AbstractDataTypeConstructor } = {
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
    }

    protected async fetchColumnIndexMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string,
        column: string
    ): Promise<IIndexMetadata[]> {
        // TODO

        return [];
    }

    protected async fetchColumnsMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string
    ): Promise<IColumnMetadata[]> {
        const columnsMetadata: IColumnMetadata[] = [];

        const query = `
            SELECT c.*, tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE
            FROM information_schema.columns c
            LEFT OUTER JOIN information_schema.key_column_usage ku
                 ON c.TABLE_CATALOG = ku.TABLE_CATALOG AND c.TABLE_NAME = ku.TABLE_NAME AND
                    c.COLUMN_NAME = ku.COLUMN_NAME
            LEFT OUTER JOIN information_schema.table_constraints tc
                 ON c.TABLE_CATALOG = tc.TABLE_CATALOG AND c.TABLE_NAME = tc.TABLE_NAME AND
                    ku.CONSTRAINT_CATALOG = tc.CONSTRAINT_CATALOG AND ku.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE c.TABLE_CATALOG = '${config.connection.database}' AND c.TABLE_NAME = '${table}'
            ORDER BY c.ORDINAL_POSITION;
        `;

        const columns = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IColumnMetadataMSSQL[];

        // TODO

        return [];
    }

    protected async fetchTableNames(
        connection: Sequelize,
        config: IConfig
    ): Promise<string[]> {
        // TODO

        return [];
    }

}
