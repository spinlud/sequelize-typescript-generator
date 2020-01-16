import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataType, getSequelizeTypeByDesignType } from 'sequelize-typescript';
import { Dialect, IDialectOptions } from './Dialect';
import { ITableMetadata } from './metadata';

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
    GENERATION_EXPRESSION: string;
}

/**
 * Dialect for MySQL
 * @class DialectMySQL
 */
export class DialectMySQL extends Dialect {

    constructor(connection: Sequelize, options: IDialectOptions) {
        super(connection, options);
    }

    public readonly sequelizeDataTypesMap = {
        bigint: DataType.BIGINT,
        smallint: DataType.SMALLINT,
        mediumint: DataType.MEDIUMINT,
        tinyint: DataType.TINYINT,
        decimal: DataType.DECIMAL,
        varchar: DataType.STRING,
        char: DataType.CHAR,
        date: DataType.DATEONLY,
        datetime: DataType.DATE,
        time: DataType.TIME,
        timestamp: DataType.DATE,
        float: DataType.FLOAT,
        double: DataType.DOUBLE,
        bit: DataType.BOOLEAN,
        enum: DataType.ENUM,
        binary: DataType.STRING,
        blob: DataType.BLOB,
        geometry: DataType.GEOMETRY,
        // geometrycollection: DataType.,
        // point: DataType.,
        // multipoint: DataType.,
        multilinestring: DataType.STRING,
        // multipolygon: DataType.,
        int: DataType.INTEGER,
        json: DataType.JSON,
        linestring: DataType.STRING,
        mediumtext: DataType.STRING,
        longblob: DataType.BLOB,
        longtext: DataType.STRING,
        // set: DataType.,
        tinyblob: DataType.BLOB,
        tinytext: DataType.STRING,
        year: DataType.STRING,
    };

    public readonly jsDataTypesMap = {
        bigint: 'bigint',
        smallint: 'number',
        mediumint: 'number',
        tinyint: 'number',
        decimal: 'number',
        varchar: 'string',
        char: 'string',
        date: 'string',
        datetime: 'string',
        time: 'string',
        timestamp: 'string',
        float: 'number',
        double: 'number',
        bit: 'boolean',
        enum: 'enum',
        binary: 'string',
        blob: 'Buffer',
        geometry: 'object',
        geometrycollection: 'object',
        point: 'object',
        multipoint: 'object',
        multilinestring: 'string',
        multipolygon: 'object',
        int: 'number',
        json: 'object',
        linestring: 'string',
        mediumtext: 'string',
        longblob: 'Buffer',
        longtext: 'string',
        set: 'Set<string>',
        tinyblob: 'Buffer',
        tinytext: 'string',
        year: 'string',
    }

    async getMetadata(): Promise<ITableMetadata[]> {
        const { schemaName } = this.options;
        const tablesMetadata: ITableMetadata[] = [];

        const tableNamesQuery = `
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = '${schemaName}';
        `;

        const tableNames: string[] = (await this.connection.query(
            tableNamesQuery,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        )).map(row => row['table_name' as keyof typeof row] as string);

        for (const tableName of tableNames) {
            const tableMetadataQuery = `
                SELECT *
                FROM information_schema.columns
                WHERE (table_schema='${schemaName}' and table_name = '${tableName}')
                order by ordinal_position;
            `;

            const columnsMetadata = await this.connection.query(
                tableMetadataQuery,
                {
                    type: QueryTypes.SELECT,
                    raw: true,
                }
            ) as IColumnMetadataMySQL[];

            const tableMetadata: ITableMetadata = {
                name: tableName,
                columns: [],
            };

            for (const columnMetadata of columnsMetadata) {
                tableMetadata.columns.push({
                    name: columnMetadata.COLUMN_NAME,
                    type: columnMetadata.DATA_TYPE,
                    typeExt: columnMetadata.COLUMN_TYPE,
                    allowNull: columnMetadata.IS_NULLABLE === 'YES',
                    primaryKey: columnMetadata.COLUMN_KEY === 'PRI',
                    autoIncrement: columnMetadata.EXTRA === 'auto_increment',
                })
            }

            tablesMetadata.push(tableMetadata);
        }

        return tablesMetadata;
    }

}
