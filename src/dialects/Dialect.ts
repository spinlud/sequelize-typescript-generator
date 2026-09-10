import { IndexType, IndexMethod, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize } from 'sequelize';
import { IConfig } from '../config/index.js';
import { createConnection } from "../connection/index.js";
import { AssociationsParser, IAssociationMetadata } from './AssociationsParser.js'
import { caseTransformer } from './utils.js';
import { applyForeignKeyConstraintsToColumns } from './foreignKeys.js';
import { discoverAssociations, isAssociationDiscoveryEnabled } from './associationDiscovery.js';
import { applyAssociationsFile } from './associationsFileMerge.js';
import { findParanoidColumn, resolveParanoidOption } from './paranoid.js';
import type { ReferentialAction } from './foreignKeys.js';
import type { ISequelizeDataType } from './dataTypes.js';

export interface ITablesMetadata {
    [tableName: string]: ITableMetadata;
}

export interface ITableMetadata {
    name: string; // Model name
    originName: string; // Database table name
    schema?: 'public' | string; // Postgres and SQL Server
    timestamps?: boolean;
    paranoid?: boolean; // Set when --paranoid is active and a soft-delete column exists
    deletedAt?: string; // Model attribute name of the soft-delete column
    hasTrigger?: boolean; // SQL Server: table has at least one enabled trigger
    columns: {
        [columnName: string]: IColumnMetadata;
    }
    foreignKeys?: IForeignKeyConstraintMetadata[]; // Every constraint on the table, database names, composite included
    associations?: IAssociationMetadata[];
    comment?: string;
}

export interface IColumnForeignKeyMetadata {
    name: string; // Source column (model field name)
    targetModel: string; // Target model name
    targetKey?: string; // Target column (model field name); absent for associations-file entries
    constraintName?: string;
    onDelete?: ReferentialAction;
    onUpdate?: ReferentialAction;
    isUnique?: boolean; // Source column is covered by a single-column primary key, unique constraint or unique index
}

export interface IForeignKeyConstraintMetadata {
    constraintName: string;
    sourceTable: string; // Database table name
    sourceColumns: string[]; // Database column names in constraint order
    targetSchema?: string; // Present on dialects with schemas
    targetTable: string; // Database table name
    targetColumns: string[]; // Database column names in constraint order
    onDelete: ReferentialAction;
    onUpdate: ReferentialAction;
    isSourceColumnUnique: boolean; // Only meaningful for single-column constraints; false for composite ones
}

export interface IColumnMetadata {
    name: string; // Model field name
    originName: string; // Database column name
    type: string;
    typeExt: string;
    dataType?: string; // Rendered decorators expression, e.g. DataType.DECIMAL(7,3)
    sequelizeType?: ISequelizeDataType; // Format-neutral Sequelize type (key + arguments)
    primaryKey: boolean;
    foreignKey?: IColumnForeignKeyMetadata;
    allowNull: boolean;
    autoIncrement: boolean;
    indices?: IIndexMetadata[],
    comment?: string;
    defaultValue?: any;
}

export interface IIndexMetadata {
    name: string;
    type?: IndexType;
    unique?: boolean;
    using?: IndexMethod;
    collation?: string | null;
    seq?: number;
}

export interface ITable {
    name: string;
    schema?: string; // Postgres and SQL Server
    isView?: boolean; // MySQL and MariaDB list views alongside tables
    comment?: string;
}

export const DIALECT_NAMES = [
    'postgres',
    'mysql',
    'mariadb',
    'sqlite',
    'mssql',
] as const;

export type DialectName = typeof DIALECT_NAMES[number];

export abstract class Dialect {
    /**
     * Accepted dialects
     */
    public static dialects: Set<string> = new Set(DIALECT_NAMES);

    /**
     * Dialect name
     */
    public name: DialectName;

    /**
     * @constructor
     * @param {DialectName} name
     * @protected
     */
    protected constructor(name: DialectName) {
        this.name = name;
    }

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
     * Map database default values to Sequelize type (e.g. uuid() => DataType.UUIDV4).
     * @param {string} v
     * @returns {string}
     */
    public abstract mapDefaultValueToSequelize(v: string): string;

    /**
     * Fetch table names for the provided database/schema
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @returns {Promise<string[]>}
     */
    protected abstract fetchTables(
        connection: Sequelize,
        config: IConfig
    ): Promise<ITable[]>;

    /**
     * Fetch columns metadata for the provided schema and table
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {string} table
     * @returns {Promise<IColumnMetadata[]>}
     */
    protected abstract fetchColumnsMetadata(
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
    protected abstract fetchColumnIndexMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string,
        column: string
    ): Promise<IIndexMetadata[]>;

    /**
     * Fetch foreign key constraints for the provided table
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {ITable} table
     * @returns {Promise<IForeignKeyConstraintMetadata[]>}
     */
    protected abstract fetchForeignKeysMetadata(
        connection: Sequelize,
        config: IConfig,
        table: ITable
    ): Promise<IForeignKeyConstraintMetadata[]>;

    /**
     * Report whether the table has at least one enabled trigger. Overridden by
     * SQL Server; every other dialect keeps the default of no triggers.
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {ITable} table
     * @returns {Promise<boolean>}
     */
    protected async fetchTableHasTrigger(
        connection: Sequelize,
        config: IConfig,
        table: ITable
    ): Promise<boolean> {
        return false;
    }

    /**
     * Build tables metadata for the specific dialect and schema
     * @param {IConfig} config
     * @returns {Promise<ITableMetadata[]>}
     */
    public async buildTablesMetadata(config: IConfig): Promise<ITablesMetadata> {
        let connection: Sequelize | undefined;
        const tablesMetadata: ITablesMetadata = {};

        try {
            connection = createConnection(config.connection);

            await connection.authenticate();

            let tables = await this.fetchTables(connection, config);

            const paranoidResolution = resolveParanoidOption(config.metadata);

            if (paranoidResolution.warning) {
                console.warn('[WARNING]', paranoidResolution.warning);
            }

            // Apply filters
            tables = tables
                .filter(({ name }) => {
                    if (config.metadata?.tables?.length) {
                        return config.metadata.tables.includes(name.toLowerCase());
                    }
                    else {
                        return true;
                    }
                }).filter(({ name }) => {
                    if (config.metadata?.skipTables?.length) {
                        return !(config.metadata.skipTables.includes(name.toLowerCase()));
                    }
                    else {
                        return true;
                    }
                });

            for (const table of tables) {
                const { name: tableName, comment: tableComment } = table;
                const columnsMetadata = await this.fetchColumnsMetadata(connection, config, tableName);

                // Fetch indices metadata if required
                if (config.metadata?.indices) {
                    for (const column of columnsMetadata) {
                        column.indices = await this.fetchColumnIndexMetadata(connection, config, tableName, column.name);
                    }
                }

                const foreignKeys = table.isView
                    ? []
                    : await this.fetchForeignKeysMetadata(connection, config, table);

                const hasTrigger = await this.fetchTableHasTrigger(connection, config, table);

                let paranoid = false;
                let deletedAt: string | undefined;

                if (paranoidResolution.enabled && !table.isView) {
                    const paranoidColumn = findParanoidColumn(columnsMetadata);

                    if (paranoidColumn) {
                        paranoid = true;
                        deletedAt = paranoidColumn.originName;
                    }
                }

                const tableMetadata: ITableMetadata = {
                    originName: tableName,
                    name: tableName,
                    schema: table.schema ?? config.connection.schema,
                    timestamps: config.metadata?.timestamps ?? false,
                    ...paranoid && { paranoid: true },
                    ...deletedAt && { deletedAt },
                    columns: {},
                    foreignKeys,
                    ...hasTrigger && { hasTrigger: true },
                    comment: tableComment ?? undefined,
                };

                for (const columnMetadata of columnsMetadata) {
                    tableMetadata.columns[columnMetadata.name] = columnMetadata;
                }

                tablesMetadata[tableMetadata.originName] = tableMetadata;
            }

            // Copy single-column foreign key constraints onto their source columns,
            // limited to constraints whose target table is generated.
            const generatedTables = new Set(Object.keys(tablesMetadata));

            for (const [tableName, tableMetadata] of Object.entries(tablesMetadata)) {
                tablesMetadata[tableName] = applyForeignKeyConstraintsToColumns(tableMetadata, generatedTables);
            }
        }
        catch(err) {
            throw new Error('Failed to build tables metadata from the source database', { cause: err });
        }
        finally {
            connection && await connection.close();
        }

        let finalTablesMetadata: ITablesMetadata = tablesMetadata;

        // Discover associations from foreign key constraints unless disabled.
        if (isAssociationDiscoveryEnabled(config.metadata)) {
            const discovery = discoverAssociations(finalTablesMetadata);
            finalTablesMetadata = discovery.tablesMetadata;

            for (const warning of discovery.warnings) {
                console.warn('[WARNING]', warning);
            }
        }

        // Apply the associations file on top of the discovered associations.
        if (config.metadata?.associationsFile) {
            const parsedAssociations = AssociationsParser.parse(config.metadata.associationsFile);
            const merge = applyAssociationsFile(finalTablesMetadata, parsedAssociations);
            finalTablesMetadata = merge.tablesMetadata;

            for (const warning of merge.warnings) {
                console.warn('[WARNING]', warning);
            }
        }

        // Apply transformations if required
        if (config.metadata?.case) {
            const transformed: ITablesMetadata = {};

            for (const [tableName, tableMetadata] of Object.entries(finalTablesMetadata)) {
                transformed[tableName] = caseTransformer(tableMetadata, config.metadata.case);
            }

            finalTablesMetadata = transformed;
        }

        return finalTablesMetadata;
    }
}
