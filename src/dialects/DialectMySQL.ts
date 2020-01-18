import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { createConnection } from '../connection';
import { IConfig } from '../config';
import { ITableMetadata, Dialect } from './Dialect';

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
        enum: 'string',
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

    /**
     * Fetch tables metadata from the database
     * @param {IConfig} config
     * @returns {Promise<ITableMetadata[]>}
     */
    async fetchMetadata(config: IConfig): Promise<ITableMetadata[]> {

        let connection: Sequelize | undefined;
        const tablesMetadata: ITableMetadata[] = [];

        try {
            connection = createConnection(config.connection);

            await connection.authenticate();

            const { database } = config.connection;

            const tableNamesQuery = `
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = '${database}';
            `;

            const tableNames: string[] = (await connection.query(
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
                WHERE (table_schema='${database}' and table_name = '${tableName}')
                order by ordinal_position;
            `;

                const columnsMetadata = await connection.query(
                    tableMetadataQuery,
                    {
                        type: QueryTypes.SELECT,
                        raw: true,
                    }
                ) as IColumnMetadataMySQL[];

                const tableMetadata: ITableMetadata = {
                    name: tableName,
                    timestamps: config.metadata?.timestamps ?? false,
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
        }
        catch(err) {
            console.error(err);
            process.exit(1);
        }
        finally {
            connection && await connection.close();
        }

        return tablesMetadata;
    }

}
