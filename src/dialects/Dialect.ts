import { IndexType, IndexMethod, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { IConfig } from '../config';
import { createConnection } from "../connection";
import { AssociationsParser, IAssociationMetadata, IForeignKey } from './AssociationsParser'
import { caseTransformer, noSchemaPrefix, populateFullTableNameDictionary, Dictionary } from './utils';

export interface ITablesMetadata {
    [tableName: string]: ITableMetadata;
}

export interface ITableName {
    name: string; // Model name
    schema?: 'public' | string; //'public' default for Postgres
    fullTableName: string;
}

export interface ITable extends ITableName {
    comment?: string;
}

export interface ITableMetadata extends ITable {
    originName: string; // Database table name
    timestamps?: boolean;
    columns: {
        [columnName: string]: IColumnMetadata;
    }
    associations?: IAssociationMetadata[];
}

export interface IColumnMetadata {
    name: string; // Model field name
    originName: string; // Database column name
    type: string;
    typeExt: string;
    dataType?: string;
    primaryKey: boolean;
    foreignKey?: IForeignKey;
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

export interface ITableRow {
    table_name: string;
    table_comment?: string;
    schema_name?: string;
}

type DialectName = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'mssql';

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
    public abstract fetchTables(
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
        table: ITable
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
        table: ITable,
        column: string
    ): Promise<IIndexMetadata[]>;

    /**
     * Build tables metadata for the specific dialect and schema
     * @param {IConfig} config
     * @returns {Promise<ITableMetadata[]>}
     */
    public async buildTablesMetadata(config: IConfig): Promise<ITablesMetadata> {
        let connection: Sequelize | undefined;
        const tablesMetadata: ITablesMetadata = {};
        const tableNameDictionary: Dictionary<ITableName> = {};

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

            const allTables = await this.fetchTables(connection, config);
            
            // Apply filters
            // NOTE: `tables` and `skipTables` are already lowercase
            const includeFullTableNames = !!config.metadata?.tables?.length ? config.metadata.tables.map(t => !t.schema ? noSchemaPrefix + t.name : t.fullTableName) : [];
            const skipFullTableNames = !!config.metadata?.skipTables?.length ? config.metadata.skipTables.map(t => !t.schema ? noSchemaPrefix + t.name : t.fullTableName) : [];

            // Matching on a dummy schema in case the database or user input doesn't provide schema data
            const tables = allTables
                .filter(({ fullTableName, name }) => includeFullTableNames.length == 0 || includeFullTableNames.some(i => i === fullTableName.toLowerCase() || i === noSchemaPrefix + name.toLowerCase()))
                .filter(({ fullTableName, name }) => skipFullTableNames.length == 0 || !skipFullTableNames.some(i => i === fullTableName.toLowerCase() || i === noSchemaPrefix + name.toLowerCase()));

            populateFullTableNameDictionary(tables, tableNameDictionary);

            for (const table of tables) {
                const columnsMetadata = await this.fetchColumnsMetadata(connection, config, table);

                // Fetch indices metadata if required
                if (config.metadata?.indices) {
                    for (const column of columnsMetadata) {
                        column.indices = await this.fetchColumnIndexMetadata(connection, config, table, column.name);
                    }
                }

                const tableSchema = !!table.schema
                    ? table.schema
                    : config.metadata?.schema;

                const tableMetadata: ITableMetadata = {
                    originName: table.name,
                    ...table,
                    ...tableSchema && { schema: tableSchema},
                    timestamps: config.metadata?.timestamps ?? false,
                    columns: {}
                };

                for (const columnMetadata of columnsMetadata) {
                    tableMetadata.columns[columnMetadata.name] = columnMetadata;
                }

                tablesMetadata[tableMetadata.fullTableName] = tableMetadata;
            }
        }
        catch(err) {
            console.error(err);
            process.exit(1);
        }
        finally {
            connection && await connection.close();
        }

        // Apply associations if required
        if (config.metadata?.associationsFile) {
            const parsedAssociations = AssociationsParser.parse(tableNameDictionary, config.metadata?.associationsFile);

            for (const [fullTableName, association] of Object.entries(parsedAssociations)) {

                if(!!association.errors?.length) {
                    association.errors.forEach(e => {
                        console.warn('[WARNING]', e);
                    });
                    console.warn(`Available table names: (${Object.keys(tablesMetadata).join(', ')})`)
                    continue;
                }

                // Attach associations to table
                tablesMetadata[fullTableName].associations = association.associations;

                const { columns } = tablesMetadata[fullTableName];

                // Override foreign keys
                for (const { name: columnName, targetModel, hasMultipleForSameTarget } of association.foreignKeys) {
                    if (!columns[columnName]) {
                        console.warn('[WARNING]', `Foreign key column ${columnName} not found among (${Object.keys(columns).join(', ')})`);
                        continue;
                    }

                    columns[columnName].foreignKey = {
                        name: columnName,
                        targetModel: targetModel,
                        hasMultipleForSameTarget
                    };
                }
            }
        }

        // Apply transformations if required
        if (config.metadata?.case) {
            for (const [tableName, tableMetadata] of Object.entries(tablesMetadata)) {
                tablesMetadata[tableName] = caseTransformer(tableMetadata, config.metadata.case);
            }
        }

        return tablesMetadata;
    }
}
