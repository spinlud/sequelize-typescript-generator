import pluralize from 'pluralize';
import { camelCase } from 'change-case';
import type { ITablesMetadata, ITableMetadata, IForeignKeyConstraintMetadata } from './Dialect.js';
import type { IAssociationMetadata } from './AssociationsParser.js';
import type { IConfigMetadata } from '../config/IConfig.js';
import {
    classifyForeignKeyConstraint,
    ForeignKeySkipReason,
} from './foreignKeys.js';

/**
 * Foreign key column name suffixes stripped when deriving an alias from the column.
 */
export const FOREIGN_KEY_COLUMN_SUFFIXES = ['_id', '_fk', 'Id', 'Fk'] as const;

/**
 * Maximum numeric suffix tried when resolving an alias collision.
 */
const MAX_ALIAS_SUFFIX = 1000;

/**
 * Result of association discovery: a new tables metadata carrying the discovered
 * associations and one warning per constraint that could not become an association.
 */
export interface IAssociationDiscoveryResult {
    tablesMetadata: ITablesMetadata;
    warnings: string[];
}

/**
 * A pair of aliases for the two sides of a discovered association.
 */
export interface IAliasPair {
    belongsToAlias: string;
    hasAlias: string;
}

/**
 * Strip a foreign key column suffix to derive an alias stem.
 * @param {string} columnName
 * @returns {string | undefined} the stem, or undefined when no suffix matches or the remainder is empty
 */
export const stripForeignKeyColumnSuffix = (columnName: string): string | undefined => {
    for (const suffix of FOREIGN_KEY_COLUMN_SUFFIXES) {
        if (columnName.length > suffix.length && columnName.endsWith(suffix)) {
            return columnName.slice(0, columnName.length - suffix.length);
        }
    }

    return undefined;
};

/**
 * The side of the source model an association exposes: singular for one-to-one,
 * plural otherwise.
 * @param {string} sourceModel
 * @param {boolean} isOneToOne
 * @returns {string}
 */
const buildSourceSideName = (sourceModel: string, isOneToOne: boolean): string =>
    isOneToOne ? pluralize.singular(sourceModel) : pluralize.plural(sourceModel);

/**
 * Aliases used when a single constraint links the two tables.
 * @param {string} sourceModel
 * @param {string} targetModel
 * @param {boolean} isOneToOne
 * @returns {IAliasPair}
 */
const buildPrimaryAliases = (sourceModel: string, targetModel: string, isOneToOne: boolean): IAliasPair => ({
    belongsToAlias: pluralize.singular(targetModel),
    hasAlias: buildSourceSideName(sourceModel, isOneToOne),
});

/**
 * Aliases derived from the foreign key column stem, used to disambiguate two
 * constraints that link the same pair of tables.
 * @param {string} stem
 * @param {string} sourceModel
 * @param {boolean} isOneToOne
 * @returns {IAliasPair}
 */
const buildStrippedAliases = (stem: string, sourceModel: string, isOneToOne: boolean): IAliasPair => ({
    belongsToAlias: stem,
    hasAlias: camelCase(`${stem} ${buildSourceSideName(sourceModel, isOneToOne)}`),
});

/**
 * Aliases composed from the target model and the foreign key column, used when the
 * column has no strippable suffix.
 * @param {string} sourceModel
 * @param {string} targetModel
 * @param {string} foreignKeyColumn
 * @param {boolean} isOneToOne
 * @returns {IAliasPair}
 */
const buildFallbackAliases = (
    sourceModel: string,
    targetModel: string,
    foreignKeyColumn: string,
    isOneToOne: boolean
): IAliasPair => ({
    belongsToAlias: camelCase(`${pluralize.singular(targetModel)} ${foreignKeyColumn}`),
    hasAlias: camelCase(`${foreignKeyColumn} ${buildSourceSideName(sourceModel, isOneToOne)}`),
});

/**
 * Resolve the primary alias pair for an association, before any collision handling.
 * Unambiguous constraints use the singular/plural model names; ambiguous ones use the
 * stripped foreign key stem when available, otherwise the composed fallback form.
 * @param {{ sourceModel: string; targetModel: string; foreignKeyColumn: string; isAmbiguous: boolean; isOneToOne: boolean }} input
 * @returns {IAliasPair}
 */
export const resolveAssociationAliases = (input: {
    sourceModel: string;
    targetModel: string;
    foreignKeyColumn: string;
    isAmbiguous: boolean;
    isOneToOne: boolean;
}): IAliasPair => {
    const { sourceModel, targetModel, foreignKeyColumn, isAmbiguous, isOneToOne } = input;

    if (!isAmbiguous) {
        return buildPrimaryAliases(sourceModel, targetModel, isOneToOne);
    }

    const stem = stripForeignKeyColumnSuffix(foreignKeyColumn);

    if (stem !== undefined) {
        return buildStrippedAliases(stem, sourceModel, isOneToOne);
    }

    return buildFallbackAliases(sourceModel, targetModel, foreignKeyColumn, isOneToOne);
};

/**
 * Warning texts for constraints that cannot become associations.
 * @param {IForeignKeyConstraintMetadata} constraint
 * @param {string | undefined} sourceSchema
 * @param {ForeignKeySkipReason} reason
 * @returns {string}
 */
export const formatForeignKeySkipWarning = (
    constraint: IForeignKeyConstraintMetadata,
    sourceSchema: string | undefined,
    reason: ForeignKeySkipReason
): string => {
    switch (reason) {
        case 'composite':
            return `Foreign key constraint '${constraint.constraintName}' on table '${constraint.sourceTable}' `
                + `spans columns (${constraint.sourceColumns.join(', ')}); Sequelize associations need a single `
                + `column, so the columns are generated as plain attributes`;
        case 'cross-schema':
            return `Foreign key constraint '${constraint.constraintName}' on table `
                + `'${sourceSchema}.${constraint.sourceTable}' references table `
                + `'${constraint.targetSchema}.${constraint.targetTable}' in another schema; `
                + `the column is generated as a plain attribute`;
        case 'excluded-target':
            return `Foreign key constraint '${constraint.constraintName}' on table '${constraint.sourceTable}' `
                + `references table '${constraint.targetTable}', which is not among the generated tables; `
                + `the column is generated as a plain attribute`;
    }
};

/**
 * Whether association discovery is enabled for the given config metadata.
 * @param {IConfigMetadata | undefined} metadata
 * @returns {boolean}
 */
export const isAssociationDiscoveryEnabled = (metadata: IConfigMetadata | undefined): boolean =>
    metadata?.associations !== false;

/**
 * Ordered alias-pair candidates tried when resolving a collision: the primary form
 * (only when unambiguous), the ambiguous form, the fallback form, then the fallback
 * form with an increasing numeric suffix.
 */
const buildAliasCandidates = (input: {
    sourceModel: string;
    targetModel: string;
    foreignKeyColumn: string;
    isAmbiguous: boolean;
    isOneToOne: boolean;
}): IAliasPair[] => {
    const { sourceModel, targetModel, foreignKeyColumn, isOneToOne } = input;
    const candidates: IAliasPair[] = [];

    if (!input.isAmbiguous) {
        candidates.push(buildPrimaryAliases(sourceModel, targetModel, isOneToOne));
    }

    candidates.push(resolveAssociationAliases({ ...input, isAmbiguous: true }));

    const fallback = buildFallbackAliases(sourceModel, targetModel, foreignKeyColumn, isOneToOne);
    candidates.push(fallback);

    for (let suffix = 2; suffix < MAX_ALIAS_SUFFIX; suffix++) {
        candidates.push({
            belongsToAlias: `${fallback.belongsToAlias}${suffix}`,
            hasAlias: `${fallback.hasAlias}${suffix}`,
        });
    }

    return candidates;
};

/**
 * Lazily build the set of names already taken on a model, seeded with its column
 * field names.
 */
const getTakenNames = (
    takenByModel: Map<string, Set<string>>,
    tablesMetadata: ITablesMetadata,
    modelKey: string
): Set<string> => {
    const existing = takenByModel.get(modelKey);

    if (existing) {
        return existing;
    }

    const taken = new Set<string>();
    const table = tablesMetadata[modelKey];

    if (table) {
        for (const column of Object.values(table.columns)) {
            taken.add(column.name);
        }
    }

    takenByModel.set(modelKey, taken);

    return taken;
};

/**
 * Pick the first candidate alias pair whose names are free on both models. For a
 * self-reference both names live on the source model and must differ.
 */
const pickFreeAliases = (
    candidates: IAliasPair[],
    sourceTaken: Set<string>,
    targetTaken: Set<string>,
    isSelfReference: boolean
): IAliasPair => {
    for (const candidate of candidates) {
        if (isSelfReference) {
            const isFree = candidate.belongsToAlias !== candidate.hasAlias
                && !sourceTaken.has(candidate.belongsToAlias)
                && !sourceTaken.has(candidate.hasAlias);

            if (isFree) {
                return candidate;
            }

            continue;
        }

        if (!sourceTaken.has(candidate.belongsToAlias) && !targetTaken.has(candidate.hasAlias)) {
            return candidate;
        }
    }

    return candidates[candidates.length - 1];
};

/**
 * Count the eligible constraints on a table that target a given table.
 */
const countEligibleConstraintsToTarget = (
    constraints: IForeignKeyConstraintMetadata[],
    sourceSchema: string | undefined,
    generatedTables: ReadonlySet<string>,
    targetTable: string
): number =>
    constraints.filter(constraint =>
        classifyForeignKeyConstraint(constraint, sourceSchema, generatedTables).isEligible
        && constraint.targetTable === targetTable
    ).length;

/**
 * Derive one-to-one and one-to-many associations from the foreign key constraints of
 * every table. Returns a new tables metadata with discovered associations appended and
 * a warning per constraint that cannot become an association. The input is not mutated.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {IAssociationDiscoveryResult}
 */
export const discoverAssociations = (tablesMetadata: ITablesMetadata): IAssociationDiscoveryResult => {
    const warnings: string[] = [];
    const generatedTables = new Set(Object.values(tablesMetadata).map(table => table.originName));
    const takenByModel = new Map<string, Set<string>>();
    const discoveredByModel = new Map<string, IAssociationMetadata[]>();

    const appendAssociation = (modelKey: string, association: IAssociationMetadata): void => {
        const list = discoveredByModel.get(modelKey) ?? [];
        list.push(association);
        discoveredByModel.set(modelKey, list);
    };

    for (const sourceKey of Object.keys(tablesMetadata)) {
        const sourceTable = tablesMetadata[sourceKey];
        const constraints = sourceTable.foreignKeys ?? [];

        for (const constraint of constraints) {
            const classification = classifyForeignKeyConstraint(constraint, sourceTable.schema, generatedTables);

            if (!classification.isEligible) {
                warnings.push(formatForeignKeySkipWarning(constraint, sourceTable.schema, classification.reason));
                continue;
            }

            const foreignKeyColumn = constraint.sourceColumns[0];
            const targetColumn = constraint.targetColumns[0];
            const targetKey = constraint.targetTable;

            const column = Object.values(sourceTable.columns).find(
                candidate => candidate.originName === foreignKeyColumn
            );

            if (!column) {
                continue;
            }

            const primaryKeyColumns = Object.values(sourceTable.columns).filter(candidate => candidate.primaryKey);
            const isOneToOne = constraint.isSourceColumnUnique
                || (column.primaryKey && primaryKeyColumns.length === 1);

            const isSelfReference = sourceTable.originName === constraint.targetTable;
            const eligibleToTarget = countEligibleConstraintsToTarget(
                constraints,
                sourceTable.schema,
                generatedTables,
                constraint.targetTable
            );
            const isAmbiguous = eligibleToTarget > 1 || isSelfReference;

            const candidates = buildAliasCandidates({
                sourceModel: sourceTable.originName,
                targetModel: constraint.targetTable,
                foreignKeyColumn,
                isAmbiguous,
                isOneToOne,
            });

            const sourceTaken = getTakenNames(takenByModel, tablesMetadata, sourceKey);
            const targetTaken = getTakenNames(takenByModel, tablesMetadata, targetKey);
            const { belongsToAlias, hasAlias } = pickFreeAliases(
                candidates,
                sourceTaken,
                targetTaken,
                isSelfReference
            );

            const hasDeleteRule = constraint.onDelete !== 'NO ACTION';
            const hasUpdateRule = constraint.onUpdate !== 'NO ACTION';

            const belongsTo: IAssociationMetadata = {
                associationName: 'BelongsTo',
                targetModel: constraint.targetTable,
                alias: belongsToAlias,
                foreignKey: foreignKeyColumn,
                targetKey: targetColumn,
                ...(hasDeleteRule && { onDelete: constraint.onDelete }),
                ...(hasUpdateRule && { onUpdate: constraint.onUpdate }),
            };

            const has: IAssociationMetadata = {
                associationName: isOneToOne ? 'HasOne' : 'HasMany',
                targetModel: sourceTable.originName,
                alias: hasAlias,
                foreignKey: foreignKeyColumn,
                sourceKey: targetColumn,
                ...(hasDeleteRule && { onDelete: constraint.onDelete }),
                ...(hasUpdateRule && { onUpdate: constraint.onUpdate }),
            };

            sourceTaken.add(belongsToAlias);

            if (isSelfReference) {
                sourceTaken.add(hasAlias);
                appendAssociation(sourceKey, belongsTo);
                appendAssociation(sourceKey, has);
            } else {
                targetTaken.add(hasAlias);
                appendAssociation(sourceKey, belongsTo);
                appendAssociation(targetKey, has);
            }
        }
    }

    const nextTablesMetadata: ITablesMetadata = {};

    for (const [tableKey, table] of Object.entries(tablesMetadata)) {
        const discovered = discoveredByModel.get(tableKey);

        const nextTable: ITableMetadata = discovered
            ? { ...table, associations: [...(table.associations ?? []), ...discovered] }
            : { ...table };

        nextTablesMetadata[tableKey] = nextTable;
    }

    return { tablesMetadata: nextTablesMetadata, warnings };
};
