import { IndexType, IndexMethod, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { IConfig } from '../config';
import { createConnection } from "../connection";
import { caseTransformer } from './utils';

export interface ITableMetadata {
    name: string; // Table name
    modelName: string; // Model name
    schema?: 'public' | string; // Postgres only
    timestamps?: boolean;
    columns: IColumnMetadata[];
    comment?: string;
}

export interface IColumnMetadata {
    name: string; // Model field name
    fieldName?: string; // Map to original table field name in case of a transformation
    type: string;
    typeExt: string;
    dataType?: string;
    primaryKey: boolean;
    // foreignKey: boolean;
    allowNull: boolean;
    autoIncrement: boolean;
    indices?: IIndexMetadata[],
    comment?: string;
    // default?: ;
}

export interface IIndexMetadata {
    name: string;
    type?: IndexType;
    unique?: boolean;
    using?: IndexMethod;
    collation?: string | null;
    seq?: number;
}

export abstract class Dialect {

    /**
     * Accepted dialects
     */
    public static dialects: Set<string> = new Set([
        'postgres',
        'mysql',
        'mariadb',
        'sqlite',
        'mssql',
    ]);

    /**
     * Map database data type to sequelize data type
     * @param {string} dbType
     * @returns {string}
     */
    public abstract mapDbTypeToSequelize(dbType: string): AbstractDataTypeConstructor;

    /**
     * Map database data type to javascript data type
     * @param {string} dbType
     * @returns {string
     */
    public abstract mapDbTypeToJs(dbType: string): string;


    /**
     * Fetch table names for the provided database/schema
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @returns {Promise<string[]>}
     */
    protected abstract async fetchTableNames(
        connection: Sequelize,
        config: IConfig
    ): Promise<string[]>;

    /**
     * Fetch columns metadata for the provided schema and table
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {string} table
     * @returns {Promise<IColumnMetadata[]>}
     */
    protected abstract async fetchColumnsMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string
    ): Promise<IColumnMetadata[]>;

    /**
     * Fetch index metadata for the provided table and column
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {string} table
     * @param {string} column
     * @returns {Promise<IIndexMetadata[]>}
     */
    protected abstract async fetchColumnIndexMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string,
        column: string
    ): Promise<IIndexMetadata[]>;

    /**
     * Extract tables metadata for the specific dialect and schema
     * @param {IConfig} config
     * @returns {Promise<ITableMetadata[]>}
     */
    public async fetchMetadata(config: IConfig): Promise<ITableMetadata[]> {
        let connection: Sequelize | undefined;
        const tablesMetadata: ITableMetadata[] = [];

        try {
            // Set schema for Postgres to 'public' if not provided
            if (config.connection.dialect === 'postgres' && !config.metadata?.schema) {
                config.metadata = {
                    ...config.metadata,
                    ...{ schema: 'public'},
                };
            }

            connection = createConnection(config.connection);

            await connection.authenticate();

            let tables = await this.fetchTableNames(connection, config);

            // Apply filters
            tables = tables
                .filter(tableName => {
                    if (config.metadata?.tables?.length) {
                        return config.metadata.tables.includes(tableName.toLowerCase());
                    }
                    else {
                        return true;
                    }
                }).filter(tableName => {
                    if (config.metadata?.skipTables?.length) {
                        return !(config.metadata.skipTables.includes(tableName.toLowerCase()));
                    }
                    else {
                        return true;
                    }
                });

            for (const table of tables) {
                const columnsMetadata = await this.fetchColumnsMetadata(connection, config, table);

                for (const column of columnsMetadata) {
                    column.indices = await this.fetchColumnIndexMetadata(connection, config, table, column.name);
                }

                const tableMetadata: ITableMetadata = {
                    name: table,
                    modelName: table,
                    ...config.metadata?.schema && { schema: config.metadata!.schema},
                    timestamps: config.metadata?.timestamps ?? false,
                    columns: columnsMetadata,
                    // comment: columnsMetadataMySQL[0].TABLE_COMMENT,
                    comment: '', // TODO
                };

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

        // Apply transformations (if any)
        if (config.metadata?.case) {
            return tablesMetadata.map(tableMetadata => caseTransformer(tableMetadata, config.metadata!.case!));
        }
        else {
            return tablesMetadata;
        }
    }
}
