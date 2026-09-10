import type {
    ITableMetadata,
    IColumnForeignKeyMetadata,
    IForeignKeyConstraintMetadata,
} from './Dialect.js';

/**
 * Referential actions supported by Sequelize for onDelete/onUpdate.
 */
export const REFERENTIAL_ACTIONS = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'] as const;

export type ReferentialAction = typeof REFERENTIAL_ACTIONS[number];

/**
 * One row of a dialect foreign key query, one per (constraint, column position).
 */
export interface IForeignKeyColumnRow {
    constraintName: string;
    sourceTable: string;
    sourceColumn: string;
    targetSchema?: string;
    targetTable: string;
    targetColumn: string;
    ordinalPosition: number;
    onDelete: string; // Raw dialect spelling
    onUpdate: string; // Raw dialect spelling
    isSourceColumnUnique: boolean;
}

/**
 * Type guard for a referential action.
 * @param {string} value
 * @returns {boolean}
 */
export const isReferentialAction = (value: string): value is ReferentialAction =>
    REFERENTIAL_ACTIONS.some(action => action === value);

const REFERENTIAL_ACTION_ALIASES: { [key: string]: ReferentialAction } = {
    'NO ACTION': 'NO ACTION',
    'RESTRICT': 'RESTRICT',
    'CASCADE': 'CASCADE',
    'SET NULL': 'SET NULL',
    'SET DEFAULT': 'SET DEFAULT',
    // Postgres pg_constraint single-letter codes
    'A': 'NO ACTION',
    'R': 'RESTRICT',
    'C': 'CASCADE',
    'N': 'SET NULL',
    'D': 'SET DEFAULT',
};

/**
 * Normalize a raw referential action into a Sequelize referential action.
 * Handles underscore spellings ('NO_ACTION'), spaced spellings, mixed case and
 * Postgres single-letter codes (a/r/c/n/d). Unknown values fall back to 'NO ACTION'.
 * @param {string | null | undefined} raw
 * @returns {ReferentialAction}
 */
export const normalizeReferentialAction = (raw: string | null | undefined): ReferentialAction => {
    if (raw === null || raw === undefined) {
        return 'NO ACTION';
    }

    const normalized = raw.trim().toUpperCase().replace(/_/g, ' ');

    return REFERENTIAL_ACTION_ALIASES[normalized] ?? 'NO ACTION';
};

/**
 * Group foreign key rows by constraint, ordering columns by ordinal position.
 * The source column unique flag is only meaningful for single-column constraints
 * and is forced to false for composite ones.
 * @param {IForeignKeyColumnRow[]} rows
 * @returns {IForeignKeyConstraintMetadata[]}
 */
export const groupForeignKeyRows = (rows: IForeignKeyColumnRow[]): IForeignKeyConstraintMetadata[] => {
    const rowsByConstraint = new Map<string, IForeignKeyColumnRow[]>();

    for (const row of rows) {
        const group = rowsByConstraint.get(row.constraintName) ?? [];
        group.push(row);
        rowsByConstraint.set(row.constraintName, group);
    }

    const constraints: IForeignKeyConstraintMetadata[] = [];

    for (const [constraintName, group] of rowsByConstraint) {
        const ordered = [...group].sort((a, b) => a.ordinalPosition - b.ordinalPosition);
        const first = ordered[0];
        const isComposite = ordered.length > 1;

        constraints.push({
            constraintName,
            sourceTable: first.sourceTable,
            sourceColumns: ordered.map(row => row.sourceColumn),
            ...first.targetSchema !== undefined && { targetSchema: first.targetSchema },
            targetTable: first.targetTable,
            targetColumns: ordered.map(row => row.targetColumn),
            onDelete: normalizeReferentialAction(first.onDelete),
            onUpdate: normalizeReferentialAction(first.onUpdate),
            isSourceColumnUnique: isComposite ? false : first.isSourceColumnUnique,
        });
    }

    return constraints;
};

/**
 * Copy single-column foreign key constraints onto the matching column metadata.
 * A constraint is copied only when it targets a single column, the target table is
 * among the generated tables and the target schema matches the source table schema.
 * Composite, cross-schema and excluded-target constraints stay only in
 * tableMetadata.foreignKeys. Returns a new table metadata without mutating the input.
 * @param {ITableMetadata} tableMetadata
 * @param {ReadonlySet<string>} generatedTables
 * @returns {ITableMetadata}
 */
export const applyForeignKeyConstraintsToColumns = (
    tableMetadata: ITableMetadata,
    generatedTables: ReadonlySet<string>
): ITableMetadata => {
    const constraints = tableMetadata.foreignKeys ?? [];
    const columns = { ...tableMetadata.columns };

    for (const constraint of constraints) {
        if (constraint.sourceColumns.length !== 1) {
            continue; // Composite constraint
        }

        if (!generatedTables.has(constraint.targetTable)) {
            continue; // Target table is not generated
        }

        if (
            constraint.targetSchema !== undefined &&
            tableMetadata.schema !== undefined &&
            constraint.targetSchema !== tableMetadata.schema
        ) {
            continue; // Cross-schema constraint
        }

        const [sourceColumn] = constraint.sourceColumns;
        const [targetColumn] = constraint.targetColumns;

        const entry = Object.entries(columns).find(([, column]) => column.originName === sourceColumn);

        if (!entry) {
            continue;
        }

        const [columnName, columnMetadata] = entry;

        const foreignKey: IColumnForeignKeyMetadata = {
            name: columnMetadata.name,
            targetModel: constraint.targetTable,
            targetKey: targetColumn,
            constraintName: constraint.constraintName,
            onDelete: constraint.onDelete,
            onUpdate: constraint.onUpdate,
            isUnique: constraint.isSourceColumnUnique,
        };

        columns[columnName] = { ...columnMetadata, foreignKey };
    }

    return { ...tableMetadata, columns };
};
