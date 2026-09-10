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
 * One row returned by a dialect foreign key query, one per (constraint, column position).
 * `is_source_column_unique` carries the uniqueness predicate in whatever shape the dialect
 * returns it: a boolean (Postgres EXISTS), a 0/1 number (MySQL, MariaDB, MSSQL) or its
 * string form.
 */
export interface IForeignKeyQueryRow {
    constraint_name: string;
    source_table: string;
    source_column: string;
    target_schema: string;
    target_table: string;
    target_column: string;
    ordinal_position: number;
    on_delete: string;
    on_update: string;
    is_source_column_unique: number | boolean | string;
}

/**
 * Map a dialect foreign key query row onto a normalized foreign key column row,
 * coercing the dialect-specific uniqueness value into a boolean.
 * @param {IForeignKeyQueryRow} row
 * @returns {IForeignKeyColumnRow}
 */
export const mapForeignKeyQueryRow = (row: IForeignKeyQueryRow): IForeignKeyColumnRow => ({
    constraintName: row.constraint_name,
    sourceTable: row.source_table,
    sourceColumn: row.source_column,
    targetSchema: row.target_schema,
    targetTable: row.target_table,
    targetColumn: row.target_column,
    ordinalPosition: row.ordinal_position,
    onDelete: row.on_delete,
    onUpdate: row.on_update,
    isSourceColumnUnique: row.is_source_column_unique === true || Number(row.is_source_column_unique) === 1,
});

/**
 * Build the information_schema query that lists foreign key columns for a table.
 * MySQL and MariaDB expose identical referential_constraints, key_column_usage and
 * statistics tables, so both dialects share this query. A source column is reported
 * unique when it is covered by a single-column non-composite unique index.
 * @param {string | undefined} database
 * @param {string} table
 * @returns {string}
 */
export const buildInformationSchemaForeignKeysQuery = (
    database: string | undefined,
    table: string
): string => `
    SELECT
        rc.CONSTRAINT_NAME              AS constraint_name,
        kcu.TABLE_NAME                  AS source_table,
        kcu.COLUMN_NAME                 AS source_column,
        kcu.REFERENCED_TABLE_SCHEMA     AS target_schema,
        kcu.REFERENCED_TABLE_NAME       AS target_table,
        kcu.REFERENCED_COLUMN_NAME      AS target_column,
        kcu.ORDINAL_POSITION            AS ordinal_position,
        rc.DELETE_RULE                  AS on_delete,
        rc.UPDATE_RULE                  AS on_update,
        EXISTS (
            SELECT 1
            FROM information_schema.statistics s
            WHERE s.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                AND s.TABLE_NAME = kcu.TABLE_NAME
                AND s.COLUMN_NAME = kcu.COLUMN_NAME
                AND s.NON_UNIQUE = 0
                AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.statistics s2
                    WHERE s2.TABLE_SCHEMA = s.TABLE_SCHEMA
                        AND s2.TABLE_NAME = s.TABLE_NAME
                        AND s2.INDEX_NAME = s.INDEX_NAME
                        AND s2.SEQ_IN_INDEX > 1
                )
        ) AS is_source_column_unique
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
        ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.TABLE_NAME = rc.TABLE_NAME
    WHERE rc.CONSTRAINT_SCHEMA = '${database}' AND rc.TABLE_NAME = '${table}'
    ORDER BY rc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION;
`;

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
 * Reasons a foreign key constraint cannot become a Sequelize association.
 */
export const FOREIGN_KEY_SKIP_REASONS = ['composite', 'cross-schema', 'excluded-target'] as const;

export type ForeignKeySkipReason = typeof FOREIGN_KEY_SKIP_REASONS[number];

/**
 * Outcome of testing a foreign key constraint for association eligibility: eligible,
 * or the first rule it fails.
 */
export type ForeignKeyClassification =
    | { isEligible: true }
    | { isEligible: false; reason: ForeignKeySkipReason };

/**
 * Classify a foreign key constraint for association eligibility. A single-column
 * constraint whose target table is generated and whose target schema matches the
 * source schema is eligible; otherwise the first failing rule is returned in the
 * order composite, cross-schema, excluded-target.
 * @param {IForeignKeyConstraintMetadata} constraint
 * @param {string | undefined} sourceSchema
 * @param {ReadonlySet<string>} generatedTables
 * @returns {ForeignKeyClassification}
 */
export const classifyForeignKeyConstraint = (
    constraint: IForeignKeyConstraintMetadata,
    sourceSchema: string | undefined,
    generatedTables: ReadonlySet<string>
): ForeignKeyClassification => {
    if (constraint.sourceColumns.length !== 1) {
        return { isEligible: false, reason: 'composite' };
    }

    if (
        constraint.targetSchema !== undefined &&
        sourceSchema !== undefined &&
        constraint.targetSchema !== sourceSchema
    ) {
        return { isEligible: false, reason: 'cross-schema' };
    }

    if (!generatedTables.has(constraint.targetTable)) {
        return { isEligible: false, reason: 'excluded-target' };
    }

    return { isEligible: true };
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
        const classification = classifyForeignKeyConstraint(constraint, tableMetadata.schema, generatedTables);

        if (!classification.isEligible) {
            continue;
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
