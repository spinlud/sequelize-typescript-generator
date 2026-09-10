import { QueryTypes, AbstractDataTypeConstructor, IndexMethod } from 'sequelize';
import { Sequelize, DataTypes } from 'sequelize';
import { IConfig } from '../config/index.js';
import { IColumnMetadata, Dialect, IIndexMetadata, IForeignKeyConstraintMetadata, ITable } from './Dialect.js';
import { warnUnknownMappingForDataType } from './utils.js';
import {
    buildSequelizeDataType,
    renderDataTypeExpression,
    DATA_TYPE_NAMESPACES,
} from './dataTypes.js';
import { groupForeignKeyRows, IForeignKeyColumnRow } from './foreignKeys.js';

interface ITableRow {
    table_name: string;
    table_comment?: string;
}

interface IColumnMetadataSQLite {
    cid: number;
    dflt_value: any;
    name: string;
    notnull: number;
    pk: number;
    type: string;
}

interface IIndexMetadataSQLite {
    column_id: number,
    column_name: string,
    index_name: string,
    is_unique: number,
    origin: string,
    partial: number,
    seq: number,
    seq_number: number,
}

interface IForeignKeyRowSQLite {
    id: number;
    seq: number;
    target_table: string;
    source_column: string;
    target_column: string | null;
    on_update: string;
    on_delete: string;
}

interface IUniqueColumnRowSQLite {
    column_name: string;
}

interface ITableInfoRowSQLite {
    name: string;
    pk: number;
}

/**
 * Build a synthesized constraint name for a SQLite foreign key from its ordered source
 * columns. SQLite foreign keys are unnamed and two of them may cover the same column set,
 * so a name already produced for the table is disambiguated with the pragma_foreign_key_list
 * id; the first occurrence of a name keeps the plain form.
 * @param {string} table
 * @param {string[]} columns
 * @param {number} id
 * @param {ReadonlySet<string>} takenNames
 * @returns {string}
 */
export const synthesizeSqliteConstraintName = (
    table: string,
    columns: string[],
    id: number,
    takenNames: ReadonlySet<string>
): string => {
    const baseName = `${table}_${columns.join('_')}_fkey`;

    return takenNames.has(baseName) ? `${baseName}_${id}` : baseName;
};

/**
 * Dialect for SQLite
 * @class DialectSQLite
 */
export class DialectSQLite extends Dialect {

    constructor() {
        super('sqlite');
    }

    /**
     * Map database data type to sequelize data type
     * @param {string} dbType
     * @returns {string}
     */
    public mapDbTypeToSequelize(dbType: string): AbstractDataTypeConstructor {
        // Affinity rules from https://www.sqlite.org/datatype3.html
        const dbTypeUpper = dbType.toUpperCase();

        if (dbTypeUpper.includes('INT')) {
            return DataTypes.INTEGER;
        }
        else if (dbTypeUpper.includes('CHAR') || dbTypeUpper.includes('CLOB') || dbTypeUpper.includes('TEXT')) {
            return DataTypes.STRING;
        }
        else if (dbTypeUpper.includes('BLOB')) {
            return DataTypes.BLOB;
        }
        else if (dbTypeUpper.includes('REAL') || dbTypeUpper.includes('FLOA') || dbTypeUpper.includes('DOUB')) {
            return DataTypes.REAL;
        }
        else {
            return DataTypes.DECIMAL;
        }
    }

    /**
     * Map database data type to javascript data type
     * @param {string} dbType
     * @returns {string
     */
    public mapDbTypeToJs(dbType: string): string {
        // Affinity rules from https://www.sqlite.org/datatype3.html
        const dbTypeUpper = dbType.toUpperCase();

        if (dbTypeUpper.includes('INT')) {
            return 'number';
        }
        else if (dbTypeUpper.includes('CHAR') || dbTypeUpper.includes('CLOB') || dbTypeUpper.includes('TEXT')) {
            return 'string';
        }
        else if (dbTypeUpper.includes('BLOB')) {
            return 'Uint8Array';
        }
        else {
            return 'number';
        }
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
                name    AS table_name
            FROM sqlite_master
            WHERE type ='table' AND name NOT LIKE 'sqlite_%';
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

    protected async fetchColumnsMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string
    ): Promise<IColumnMetadata[]> {
        const columnsMetadata: IColumnMetadata[] = [];

        const query = `PRAGMA main.table_info('${table}')`;

        const columns = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IColumnMetadataSQLite[];

        for (const column of columns) {
            // Unknown data type
            if (!this.mapDbTypeToSequelize(column.type)) {
                warnUnknownMappingForDataType(column.type);
            }

            const sequelizeConstructor = this.mapDbTypeToSequelize(column.type);

            const sequelizeType = sequelizeConstructor
                ? buildSequelizeDataType(sequelizeConstructor, [])
                : undefined;

            const columnMetadata: IColumnMetadata = {
                name: column.name,
                originName: column.name,
                type: column.type,
                typeExt: column.type,
                ...sequelizeType && {
                    sequelizeType,
                    dataType: renderDataTypeExpression(sequelizeType, DATA_TYPE_NAMESPACES.decorators),
                },
                allowNull: !column.notnull,
                primaryKey: !!column.pk,
                autoIncrement: !!column.pk,
                indices: [],
                comment: '', // TODO
            };

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
                   il.seq,
                   ii.seqno AS seq_number,
                   ii.cid AS column_id,
                   ii.name as column_name,
                   il.name AS index_name,
                   il.\`unique\` AS is_unique,
                   il.origin,
                   il.partial
            FROM sqlite_master AS m,
                   pragma_index_list(m.name) AS il,
                   pragma_index_info(il.name) AS ii
            WHERE m.type = 'table' AND m.name = '${table}' AND ii.name = '${column}'
            ORDER BY il.seq;
        `;

        const indices = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IIndexMetadataSQLite[];

        for (const index of indices) {
            indicesMetadata.push({
                name: index.index_name,
                seq: index.seq_number,
                unique: !!index.is_unique,
            });
        }

        return indicesMetadata;
    }

    /**
     * Fetch foreign key constraints for the provided table. SQLite constraints have no
     * name, so each one is given the synthesized name `${table}_${sourceColumns}_fkey`,
     * built from its ordered source columns. A constraint that omits the referenced
     * column targets the primary key of the referenced table, resolved in key order.
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
        const foreignKeyRows = await connection.query<IForeignKeyRowSQLite>(
            `
                SELECT
                    id,
                    seq,
                    "table"  AS target_table,
                    "from"   AS source_column,
                    "to"     AS target_column,
                    on_update,
                    on_delete
                FROM pragma_foreign_key_list('${table.name}')
                ORDER BY id, seq;
            `,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        if (!foreignKeyRows.length) {
            return [];
        }

        const uniqueSourceColumns = await this.fetchSingleColumnUniqueColumns(connection, table.name);

        // Primary key columns per referenced table, resolved lazily for constraints
        // that omit the referenced column.
        const targetPrimaryKeyColumns = new Map<string, string[]>();

        const resolveTargetPrimaryKeyColumns = async (targetTable: string): Promise<string[]> => {
            const cached = targetPrimaryKeyColumns.get(targetTable);

            if (cached) {
                return cached;
            }

            const primaryKeyColumns = await this.fetchPrimaryKeyColumns(connection, targetTable);
            targetPrimaryKeyColumns.set(targetTable, primaryKeyColumns);

            return primaryKeyColumns;
        };

        // Rows sharing an id form one (possibly composite) constraint.
        const rowsById = new Map<number, IForeignKeyRowSQLite[]>();

        for (const row of foreignKeyRows) {
            const group = rowsById.get(row.id) ?? [];
            group.push(row);
            rowsById.set(row.id, group);
        }

        const rows: IForeignKeyColumnRow[] = [];
        const takenConstraintNames = new Set<string>();

        for (const group of rowsById.values()) {
            const ordered = [...group].sort((a, b) => a.seq - b.seq);
            const sourceColumns = ordered.map(row => row.source_column);
            const [{ id: constraintId, target_table: targetTable }] = ordered;
            const constraintName = synthesizeSqliteConstraintName(
                table.name, sourceColumns, constraintId, takenConstraintNames
            );
            takenConstraintNames.add(constraintName);

            const needsPrimaryKeyResolution = ordered.some(row => row.target_column === null);
            const targetPrimaryKey = needsPrimaryKeyResolution
                ? await resolveTargetPrimaryKeyColumns(targetTable)
                : [];

            for (const row of ordered) {
                const targetColumn = row.target_column ?? targetPrimaryKey[row.seq] ?? '';

                rows.push({
                    constraintName,
                    sourceTable: table.name,
                    sourceColumn: row.source_column,
                    targetTable: row.target_table,
                    targetColumn,
                    ordinalPosition: row.seq,
                    onDelete: row.on_delete,
                    onUpdate: row.on_update,
                    isSourceColumnUnique: uniqueSourceColumns.has(row.source_column),
                });
            }
        }

        return groupForeignKeyRows(rows);
    }

    /**
     * Collect the source columns covered by a single-column unique index or primary key,
     * used to flag one-to-one foreign keys.
     * @param {Sequelize} connection
     * @param {string} table
     * @returns {Promise<Set<string>>}
     */
    private async fetchSingleColumnUniqueColumns(
        connection: Sequelize,
        table: string
    ): Promise<Set<string>> {
        const uniqueIndexColumns = await connection.query<IUniqueColumnRowSQLite>(
            `
                SELECT ii.name AS column_name
                FROM pragma_index_list('${table}') il
                JOIN pragma_index_info(il.name) ii
                WHERE il."unique" = 1 AND il.partial = 0
                GROUP BY il.name
                HAVING COUNT(*) = 1;
            `,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        const uniqueColumns = new Set(uniqueIndexColumns.map(row => row.column_name));

        // An INTEGER PRIMARY KEY is a rowid alias with no backing index, so
        // pragma_index_list does not report it; a single-column primary key is unique.
        const tableInfo = await connection.query<ITableInfoRowSQLite>(
            `SELECT name, pk FROM pragma_table_info('${table}');`,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        const primaryKeyColumns = tableInfo.filter(column => column.pk > 0);

        if (primaryKeyColumns.length === 1) {
            uniqueColumns.add(primaryKeyColumns[0].name);
        }

        return uniqueColumns;
    }

    /**
     * Fetch the primary key column names of a table, ordered by their key position.
     * @param {Sequelize} connection
     * @param {string} table
     * @returns {Promise<string[]>}
     */
    private async fetchPrimaryKeyColumns(
        connection: Sequelize,
        table: string
    ): Promise<string[]> {
        const tableInfo = await connection.query<ITableInfoRowSQLite>(
            `SELECT name, pk FROM pragma_table_info('${table}');`,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        return tableInfo
            .filter(column => column.pk > 0)
            .sort((a, b) => a.pk - b.pk)
            .map(column => column.name);
    }

}
