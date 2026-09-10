import type { IndexMethod, InitOptions, ModelAttributeColumnOptions } from 'sequelize';
import type {
    IColumnMetadata,
    IColumnForeignKeyMetadata,
    ITableMetadata,
    ITablesMetadata,
} from '../dialects/Dialect.js';

/**
 * Attribute kinds a native column declaration can take. They drive both the
 * TypeScript type node (plain type, `T | null`, `CreationOptional<...>`,
 * `ForeignKey<...>`) and the imports the model file needs.
 */
export const ATTRIBUTE_KINDS = [
    'plain',
    'nullable',
    'creationOptional',
    'creationOptionalNullable',
    'foreignKey',
    'foreignKeyNullable',
] as const;

export type AttributeKind = typeof ATTRIBUTE_KINDS[number];

/**
 * Column option keys emitted for a native attribute, in output order.
 */
export const COLUMN_OPTION_KEYS = [
    'type',
    'primaryKey',
    'autoIncrement',
    'allowNull',
    'defaultValue',
    'comment',
    'field',
] as const satisfies readonly (keyof ModelAttributeColumnOptions)[];

/**
 * Model init option keys emitted for a native model, in output order.
 */
export const INIT_OPTION_KEYS = [
    'sequelize',
    'tableName',
    'freezeTableName',
    'schema',
    'timestamps',
    'paranoid',
    'deletedAt',
    'hasTrigger',
    'comment',
    'indexes',
] as const satisfies readonly (keyof InitOptions)[];

/**
 * Sequelize-managed timestamp attributes declared on a model when timestamps
 * are enabled.
 */
export const TIMESTAMP_ATTRIBUTES = ['createdAt', 'updatedAt'] as const;

/**
 * Report whether a column is the soft-delete marker of a paranoid table.
 * @param {IColumnMetadata} column
 * @param {ITableMetadata} table
 * @returns {boolean}
 */
export const isParanoidColumn = (column: IColumnMetadata, table: ITableMetadata): boolean =>
    table.paranoid === true && table.deletedAt === column.name;

/**
 * Report whether a column is optional at creation time. Auto-increment columns,
 * columns with a default value and the soft-delete column are populated by the
 * database or Sequelize, so they are typed with `CreationOptional`.
 * @param {IColumnMetadata} column
 * @param {ITableMetadata} table
 * @returns {boolean}
 */
export const isCreationOptionalColumn = (column: IColumnMetadata, table: ITableMetadata): boolean =>
    column.autoIncrement || column.defaultValue !== undefined || isParanoidColumn(column, table);

/**
 * Classify a column into a native attribute kind. A column that carries a
 * foreign key to a generated model is branded with `ForeignKey`; otherwise the
 * creation-optional and nullable flags decide the kind.
 * @param {IColumnMetadata} column
 * @param {ITableMetadata} table
 * @param {boolean} isForeignKeyTargetGenerated
 * @returns {AttributeKind}
 */
export const classifyAttribute = (
    column: IColumnMetadata,
    table: ITableMetadata,
    isForeignKeyTargetGenerated: boolean
): AttributeKind => {
    if (isForeignKeyTargetGenerated) {
        return column.allowNull ? 'foreignKeyNullable' : 'foreignKey';
    }

    const creationOptional = isCreationOptionalColumn(column, table);

    if (creationOptional && column.allowNull) {
        return 'creationOptionalNullable';
    }

    if (creationOptional) {
        return 'creationOptional';
    }

    return column.allowNull ? 'nullable' : 'plain';
};

/**
 * Resolve the single primary key attribute of a table. Composite and missing
 * primary keys resolve to undefined.
 * @param {ITableMetadata} table
 * @returns {string | undefined}
 */
export const resolvePrimaryKeyAttribute = (table: ITableMetadata): string | undefined => {
    const primaryKeyColumns = Object.values(table.columns).filter(column => column.primaryKey);

    return primaryKeyColumns.length === 1 ? primaryKeyColumns[0].name : undefined;
};

/**
 * Index tables by model name for lookups keyed by association and foreign key
 * target model names.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {ReadonlyMap<string, ITableMetadata>}
 */
export const indexTablesByModelName = (tablesMetadata: ITablesMetadata): ReadonlyMap<string, ITableMetadata> => {
    const tablesByModel = new Map<string, ITableMetadata>();

    for (const table of Object.values(tablesMetadata)) {
        tablesByModel.set(table.name, table);
    }

    return tablesByModel;
};

/**
 * Resolve the target attribute a foreign key references: the explicit target
 * key, otherwise the single primary key of the target model.
 * @param {IColumnForeignKeyMetadata} foreignKey
 * @param {ITableMetadata} target
 * @returns {string | undefined}
 */
export const resolveForeignKeyTargetAttribute = (
    foreignKey: IColumnForeignKeyMetadata,
    target: ITableMetadata
): string | undefined => foreignKey.targetKey ?? resolvePrimaryKeyAttribute(target);

/**
 * A native index descriptor. Fields are database column names in index order.
 */
export interface INativeIndex {
    name: string;
    isUnique: boolean;
    fields: string[];
    using?: IndexMethod;
}

/**
 * Report whether an index covers exactly the primary key column set. Such an
 * index is the implicit primary key index and is not re-emitted.
 * @param {readonly string[]} fields
 * @param {readonly string[]} primaryKeyColumns
 * @returns {boolean}
 */
export const isPrimaryKeyIndex = (
    fields: readonly string[],
    primaryKeyColumns: readonly string[]
): boolean => {
    if (primaryKeyColumns.length === 0 || fields.length !== primaryKeyColumns.length) {
        return false;
    }

    const primaryKeySet = new Set(primaryKeyColumns);

    return fields.every(field => primaryKeySet.has(field));
};

/**
 * Collect the indexes to emit for a table. Column indices are grouped by index
 * name in first-seen order while scanning columns; each index's fields are the
 * database column names in `seq` order. The implicit primary key index is
 * skipped.
 * @param {ITableMetadata} table
 * @returns {INativeIndex[]}
 */
export const collectTableIndexes = (table: ITableMetadata): INativeIndex[] => {
    const columns = Object.values(table.columns);
    const primaryKeyColumns = columns
        .filter(column => column.primaryKey)
        .map(column => column.originName);

    interface IndexAccumulator {
        name: string;
        isUnique: boolean;
        using?: IndexMethod;
        fields: Array<{ field: string; seq: number }>;
    }

    const indexesByName = new Map<string, IndexAccumulator>();

    for (const column of columns) {
        for (const index of column.indices ?? []) {
            let accumulator = indexesByName.get(index.name);

            if (!accumulator) {
                accumulator = {
                    name: index.name,
                    isUnique: index.unique ?? false,
                    ...index.using && { using: index.using },
                    fields: [],
                };

                indexesByName.set(index.name, accumulator);
            }

            accumulator.fields.push({ field: column.originName, seq: index.seq ?? 0 });
        }
    }

    const indexes: INativeIndex[] = [];

    for (const accumulator of indexesByName.values()) {
        const fields = [...accumulator.fields]
            .sort((left, right) => left.seq - right.seq)
            .map(entry => entry.field);

        if (isPrimaryKeyIndex(fields, primaryKeyColumns)) {
            continue;
        }

        indexes.push({
            name: accumulator.name,
            isUnique: accumulator.isUnique,
            fields,
            ...accumulator.using && { using: accumulator.using },
        });
    }

    return indexes;
};
