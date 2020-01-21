import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { createConnection } from '../connection';
import { IConfig } from '../config';
import { ITableMetadata, IColumnMetadata, Dialect } from './Dialect';
import { IColumnMetadataMySQL, numericPrecisionScale, dateTimePrecision } from './utils';

interface ITableNameRow {
    table_name?: string;
    TABLE_NAME?: string;
}

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

    public readonly jsDataTypesMap = {
        bigint: 'bigint',
        smallint: 'number',
        mediumint: 'number',
        tinyint: 'number',
        decimal: 'number',
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
        year: 'string',

        enum: 'string',
        set: 'any',

        binary: 'Buffer',
        blob: 'Buffer',
        tinyblob: 'Buffer',
        mediumblob: 'Buffer',
        longblob: 'Buffer',

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
            ) as ITableNameRow[]).map(row => {
                return row.table_name ?? row.TABLE_NAME!;
            });

            for (const tableName of tableNames) {
                const tableMetadataQuery = `
                SELECT *
                FROM information_schema.columns
                WHERE (table_schema='${database}' and table_name = '${tableName}')
                order by ordinal_position;
            `;

                const columnsMetadataMySQL = await connection.query(
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

                for (const columnMetadataMySQL of columnsMetadataMySQL) {
                    tableMetadata.comment = columnMetadataMySQL.COLUMN_COMMENT;

                    if (!this.sequelizeDataTypesMap[columnMetadataMySQL.DATA_TYPE]) {
                        console.warn(`[Warning]`,
                            `Unknown data type mapping for '${columnMetadataMySQL.DATA_TYPE}'`);
                        console.warn(`[Warning]`,
                            `Skipping column`, columnMetadataMySQL);
                        continue;
                    }

                    const columnMetadata: IColumnMetadata = {
                        name: columnMetadataMySQL.COLUMN_NAME,
                        type: columnMetadataMySQL.DATA_TYPE,
                        typeExt: columnMetadataMySQL.COLUMN_TYPE,
                        dataType: 'DataType.' +
                            this.sequelizeDataTypesMap[columnMetadataMySQL.DATA_TYPE].key
                                .split(' ')[0], // avoids 'DOUBLE PRECISION' key to include PRECISION in the mapping
                        allowNull: columnMetadataMySQL.IS_NULLABLE === 'YES',
                        primaryKey: columnMetadataMySQL.COLUMN_KEY === 'PRI',
                        autoIncrement: columnMetadataMySQL.EXTRA === 'auto_increment',
                    };

                    // Additional data type informations
                    switch (columnMetadataMySQL.DATA_TYPE) {
                        case 'decimal':
                        case 'numeric':
                        case 'float':
                        case 'double':
                            columnMetadata.dataType += numericPrecisionScale(columnMetadataMySQL);
                            break;

                        case 'datetime':
                        case 'timestamp':
                            columnMetadata.dataType += dateTimePrecision(columnMetadataMySQL);
                            break;
                    }

                    // ENUM: add values to data type -> DataType.ENUM('v1', 'v2')
                    if (columnMetadataMySQL.DATA_TYPE === 'enum') {
                        columnMetadata.dataType += columnMetadata.typeExt.match(/\(.*\)/)![0];
                    }

                    tableMetadata.columns.push(columnMetadata);
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
