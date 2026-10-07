import type { Format } from '../config/format.js';
import type { Dialect, IColumnMetadata, ITableMetadata, ITablesMetadata } from '../dialects/Dialect.js';

/**
 * TypeScript type given to a column with an unmapped type, per output format.
 */
export const UNMAPPED_TS_TYPE_BY_FORMAT = {
    native: 'unknown',
    decorators: 'any',
} satisfies Record<Format, string>;

/**
 * A column whose database type has no TypeScript type or no Sequelize data type
 * mapping in the dialect, with the table it belongs to.
 */
export interface IUnmappedColumn {
    table: ITableMetadata;
    column: IColumnMetadata;
}

/**
 * Report whether a column has an unmapped type: no type override matches it, it
 * is neither a JSON column nor a database enum column, and the dialect maps its
 * database type to no TypeScript type or to no Sequelize data type.
 * @param {IColumnMetadata} column
 * @param {Dialect} dialect
 * @returns {boolean}
 */
export const isUnmappedColumn = (column: IColumnMetadata, dialect: Dialect): boolean =>
    column.typeOverride === undefined &&
    !column.isJson &&
    column.enumType === undefined && (dialect.mapDbTypeToJs(column.type) === undefined || column.sequelizeType === undefined);

/**
 * Collect every column with an unmapped type, in table and column order.
 * @param {ITablesMetadata} tablesMetadata
 * @param {Dialect} dialect
 * @returns {IUnmappedColumn[]}
 */
export const findUnmappedColumns = (tablesMetadata: ITablesMetadata, dialect: Dialect): IUnmappedColumn[] =>
    Object.values(tablesMetadata).flatMap(table =>
        Object.values(table.columns)
            .filter(column => isUnmappedColumn(column, dialect))
            .map(column => ({ table, column }))
    );

/**
 * Qualified database name of a column: `schema.table.column`, or
 * `table.column` when the table has no schema.
 * @param {IUnmappedColumn} unmappedColumn
 * @returns {string}
 */
const buildQualifiedColumnName = ({ table, column }: IUnmappedColumn): string =>
    [table.schema, table.originName, column.originName]
        .filter(part => part !== undefined && part !== '')
        .join('.');

/**
 * Build the warning for a column with an unmapped type, naming the TypeScript
 * type the column receives in the given format.
 * @param {IUnmappedColumn} unmappedColumn
 * @param {Dialect} dialect
 * @param {Format} format
 * @returns {string}
 */
export const buildUnmappedTypeWarning = (
    unmappedColumn: IUnmappedColumn,
    dialect: Dialect,
    format: Format
): string => {
    const { type } = unmappedColumn.column;
    const tsType = dialect.mapDbTypeToJs(type) ?? UNMAPPED_TS_TYPE_BY_FORMAT[format];

    return `Unmapped type '${type}' for column ${buildQualifiedColumnName(unmappedColumn)}: ` +
        `typed as '${tsType}'. Declare a type override with --type-overrides-file to set its type.`;
};

/**
 * Warn once for every column with an unmapped type.
 * @param {ITablesMetadata} tablesMetadata
 * @param {Dialect} dialect
 * @param {Format} format
 * @returns {void}
 */
export const warnUnmappedTypes = (tablesMetadata: ITablesMetadata, dialect: Dialect, format: Format): void => {
    for (const unmappedColumn of findUnmappedColumns(tablesMetadata, dialect)) {
        console.warn('[WARNING]', buildUnmappedTypeWarning(unmappedColumn, dialect, format));
    }
};
