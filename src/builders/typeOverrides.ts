import type { IColumnMetadata, IColumnTypeOverride, ITableMetadata, ITablesMetadata } from '../dialects/Dialect.js';
import { formatTypeOverrideLabel } from './typeOverridesParser.js';
import type { IParsedTypeOverride, IParsedTypeOverrides } from './typeOverridesParser.js';

/**
 * Result of applying type overrides: the tables metadata with the overrides
 * applied, and the entries that matched no column.
 */
export interface ITypeOverridesApplication {
    tablesMetadata: ITablesMetadata;
    unmatchedEntries: IParsedTypeOverride[];
}

/**
 * Collect the entries matching a column, most specific first: the
 * schema-qualified column key, the unqualified column key, the schema-qualified
 * type key, then the unqualified type key. Matching is case-insensitive. The
 * schema of a type key is the schema the enum type is defined in for a database
 * enum column, and the table schema otherwise.
 * @param {ITableMetadata} table
 * @param {IColumnMetadata} column
 * @param {IParsedTypeOverrides} overrides
 * @returns {IParsedTypeOverride[]}
 */
const findMatchingEntries = (
    table: ITableMetadata,
    column: IColumnMetadata,
    overrides: IParsedTypeOverrides
): IParsedTypeOverride[] => {
    const schema = table.schema ? table.schema.toLowerCase() : undefined;
    const typeSchema = column.enumType ? column.enumType.schema.toLowerCase() : schema;
    const columnKey = `${table.originName}.${column.originName}`.toLowerCase();
    const typeKey = column.type.toLowerCase();

    const candidates = [
        schema !== undefined ? overrides.columns.get(`${schema}.${columnKey}`) : undefined,
        overrides.columns.get(columnKey),
        typeSchema !== undefined ? overrides.types.get(`${typeSchema}.${typeKey}`) : undefined,
        overrides.types.get(typeKey),
    ];

    return candidates.filter(entry => entry !== undefined);
};

/**
 * Resolve each side of the override from the most specific entry that sets it.
 * @param {IParsedTypeOverride[]} entries
 * @returns {IColumnTypeOverride}
 */
const resolveColumnTypeOverride = (entries: IParsedTypeOverride[]): IColumnTypeOverride => {
    const tsType = entries.find(entry => entry.tsType !== undefined)?.tsType;
    const dataType = entries.find(entry => entry.dataType !== undefined)?.dataType;

    return {
        ...tsType && { tsType },
        ...dataType && { dataType },
    };
};

/**
 * Attach the type override resolved for a column. The generated `sequelizeType`
 * and `dataType` stay untouched, so the TypeScript type the generator derives
 * from them is unaffected by a data type override.
 * @param {IColumnMetadata} column
 * @param {IColumnTypeOverride} typeOverride
 * @returns {IColumnMetadata}
 */
const applyColumnTypeOverride = (column: IColumnMetadata, typeOverride: IColumnTypeOverride): IColumnMetadata => ({
    ...column,
    typeOverride,
});

/**
 * Apply type overrides to every column they match, and report the entries that
 * matched no column.
 * @param {ITablesMetadata} tablesMetadata
 * @param {IParsedTypeOverrides} overrides
 * @returns {ITypeOverridesApplication}
 */
export const applyTypeOverrides = (
    tablesMetadata: ITablesMetadata,
    overrides: IParsedTypeOverrides
): ITypeOverridesApplication => {
    const matchedEntries = new Set<IParsedTypeOverride>();
    const overridden: ITablesMetadata = {};

    for (const [tableKey, table] of Object.entries(tablesMetadata)) {
        const columns: ITableMetadata['columns'] = {};

        for (const [columnKey, column] of Object.entries(table.columns)) {
            const entries = findMatchingEntries(table, column, overrides);

            entries.forEach(entry => matchedEntries.add(entry));

            columns[columnKey] = entries.length > 0
                ? applyColumnTypeOverride(column, resolveColumnTypeOverride(entries))
                : column;
        }

        overridden[tableKey] = { ...table, columns };
    }

    const unmatchedEntries = [...overrides.types.values(), ...overrides.columns.values()]
        .filter(entry => !matchedEntries.has(entry));

    return { tablesMetadata: overridden, unmatchedEntries };
};

/**
 * Build the warning listing the type override entries that matched no column.
 * @param {IParsedTypeOverride[]} unmatchedEntries
 * @returns {string}
 */
export const buildUnmatchedTypeOverridesWarning = (unmatchedEntries: IParsedTypeOverride[]): string =>
    `Type overrides matched no column: ` +
    `${unmatchedEntries.map(entry => formatTypeOverrideLabel(entry.section, entry.key)).join(', ')}. ` +
    `Check them for typos; table filters may exclude the tables they target.`;

/**
 * Warn once about the type override entries that matched no column.
 * @param {IParsedTypeOverride[]} unmatchedEntries
 * @returns {void}
 */
export const warnUnmatchedTypeOverrides = (unmatchedEntries: IParsedTypeOverride[]): void => {
    if (unmatchedEntries.length > 0) {
        console.warn('[WARNING]', buildUnmatchedTypeOverridesWarning(unmatchedEntries));
    }
};
