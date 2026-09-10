import pluralize from 'pluralize';
import type { ITablesMetadata, ITableMetadata, IColumnMetadata } from './Dialect.js';
import type { IAssociationsParsed, IAssociationMetadata } from './AssociationsParser.js';

/**
 * Result of applying the associations file on top of the discovered associations: a
 * new tables metadata and the warnings raised for entries that could not be applied.
 */
export interface IAssociationsFileMergeResult {
    tablesMetadata: ITablesMetadata;
    warnings: string[];
}

/**
 * The property name an association is emitted under: plural of the target model for
 * the many-side associations, singular otherwise.
 * @param {IAssociationMetadata} association
 * @returns {string}
 */
const resolveEffectivePropertyName = (association: IAssociationMetadata): string =>
    association.associationName.includes('Many')
        ? pluralize.plural(association.targetModel)
        : pluralize.singular(association.targetModel);

/**
 * Apply the parsed associations file on top of discovered associations. For every
 * declared foreign key the paired discovered association is dropped (junction rows keep
 * their discovered associations), the column foreign key is rewritten to the declared
 * target, the declared associations are appended, and any discovered association whose
 * alias collides with a declared association is dropped. The inputs are not mutated.
 * @param {ITablesMetadata} tablesMetadata
 * @param {IAssociationsParsed} parsed
 * @returns {IAssociationsFileMergeResult}
 */
export const applyAssociationsFile = (
    tablesMetadata: ITablesMetadata,
    parsed: IAssociationsParsed
): IAssociationsFileMergeResult => {
    const warnings: string[] = [];

    const nextTablesMetadata: ITablesMetadata = {};

    for (const [tableKey, table] of Object.entries(tablesMetadata)) {
        const columns: { [columnName: string]: IColumnMetadata } = {};

        for (const [columnName, column] of Object.entries(table.columns)) {
            columns[columnName] = {
                ...column,
                ...column.foreignKey && { foreignKey: { ...column.foreignKey } },
            };
        }

        const nextTable: ITableMetadata = {
            ...table,
            columns,
            ...table.associations !== undefined && { associations: [...table.associations] },
        };

        nextTablesMetadata[tableKey] = nextTable;
    }

    // The mutable association list of a model, created on first use.
    const getAssociations = (modelKey: string): IAssociationMetadata[] => {
        const table = nextTablesMetadata[modelKey];

        if (!table.associations) {
            table.associations = [];
        }

        return table.associations;
    };

    // Drop the discovered BelongsTo on the source model for the given foreign key column
    // and its paired Has* on the discovered target model.
    const removeDiscoveredPair = (sourceKey: string, foreignKeyColumn: string): void => {
        const sourceAssociations = getAssociations(sourceKey);
        const belongsToIndex = sourceAssociations.findIndex(
            association => association.associationName === 'BelongsTo'
                && association.foreignKey === foreignKeyColumn
        );

        if (belongsToIndex === -1) {
            return;
        }

        const [belongsTo] = sourceAssociations.splice(belongsToIndex, 1);
        const targetTable = nextTablesMetadata[belongsTo.targetModel];

        if (!targetTable || !targetTable.associations) {
            return;
        }

        const hasIndex = targetTable.associations.findIndex(
            association => (association.associationName === 'HasOne' || association.associationName === 'HasMany')
                && association.targetModel === sourceKey
                && association.foreignKey === foreignKeyColumn
        );

        if (hasIndex !== -1) {
            targetTable.associations.splice(hasIndex, 1);
        }
    };

    for (const [sourceKey, parsedTable] of Object.entries(parsed)) {
        if (!nextTablesMetadata[sourceKey]) {
            warnings.push(
                `Associated table ${sourceKey} not found among (${Object.keys(tablesMetadata).join(', ')})`
            );
            continue;
        }

        const { columns } = nextTablesMetadata[sourceKey];

        for (const { name: foreignKeyColumn, targetModel, isJunctionForeignKey } of parsedTable.foreignKeys) {
            if (!isJunctionForeignKey) {
                removeDiscoveredPair(sourceKey, foreignKeyColumn);
            }

            if (!columns[foreignKeyColumn]) {
                warnings.push(
                    `Foreign key column ${foreignKeyColumn} not found among (${Object.keys(columns).join(', ')})`
                );
                continue;
            }

            const discovered = columns[foreignKeyColumn].foreignKey;

            columns[foreignKeyColumn] = {
                ...columns[foreignKeyColumn],
                foreignKey: {
                    ...(discovered?.targetModel === targetModel ? discovered : {}),
                    name: foreignKeyColumn,
                    targetModel,
                },
            };
        }

        const sourceAssociations = getAssociations(sourceKey);

        for (const parsedAssociation of parsedTable.associations) {
            const propertyName = resolveEffectivePropertyName(parsedAssociation);

            for (let index = sourceAssociations.length - 1; index >= 0; index--) {
                const existing = sourceAssociations[index];

                if (existing.alias !== undefined && existing.alias === propertyName) {
                    warnings.push(
                        `Association alias '${existing.alias}' on table '${sourceKey}' is used by both a `
                        + `discovered association and the associations file; the associations file entry is kept`
                    );
                    sourceAssociations.splice(index, 1);
                }
            }
        }

        sourceAssociations.push(...parsedTable.associations.map(association => ({ ...association })));
    }

    return { tablesMetadata: nextTablesMetadata, warnings };
};
