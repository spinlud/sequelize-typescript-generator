import fs from 'fs';
import pluralize from 'pluralize';
import { ITableName } from './Dialect';
import { Dictionary, groupBy, parseFullTableName } from './utils';

const cardinalities = new Set([
    '1:1',
    '1:N',
    'N:N'
]);

type AssociationRow = [
    string,   // cardinality
    string,   // left key
    string,   // right key
    string,   // left table
    string,   // right table
    string?,  // [join table]
    string?,   // [right model prop name]
    string?,  // [left model prop name]
];

export type AssociationType = 'HasOne' | 'HasMany' | 'BelongsTo' | 'BelongsToMany';

export interface IAssociationMetadata {
    associationName: AssociationType;
    targetModel: ITableName;
    joinModel?: ITableName;
    sourceKey?: string;                 // Left table key for HasOne and HasMany associations
    targetKey?: string;                 // Right table key for HasOne and HasMany associations
    targetAlias?: string;               // Alias for navigation prop destination model
    targetModelPropName?: string;       // Custom field name for nav prop
    hasMultipleForSameTarget: boolean;  // Tracks if there are multiple relationships between the same 2 models
}

export interface IForeignKey {
    name: string;
    targetModel: ITableName;
    hasMultipleForSameTarget: boolean;  // Tracks if there are multiple relationships between the same 2 models
}

export interface IAssociationsParsed {
    [fullTableName: string]: {
        foreignKeys: IForeignKey[];
        associations: IAssociationMetadata[];
        errors: string[]
    }
}

const validateRow = (row: AssociationRow): void => {
    const [
        cardinality,
        leftkey,
        rightKey,
        leftTable,
        rightTable,
        joinTable
    ] = row;

    if (!cardinalities.has(cardinality)) {
        throw new Error(`Invalid cardinality: must be one of (${Array.from(cardinalities).join(', ')}). Received ${cardinality}`);
    }

    if (!leftkey || !leftkey.length) {
        throw new Error(`Missing required leftKey in association row`);
    }

    if (!rightKey || !rightKey.length) {
        throw new Error(`Missing required rightKey in association row`);
    }

    if (!leftTable || !leftTable.length) {
        throw new Error(`Missing required leftTable in association row`);
    }

    if (!rightTable || !rightTable.length) {
        throw new Error(`Missing required rightTable in association row`);
    }

    if (cardinality === 'N:N' && (!joinTable || !joinTable.length)) {
        throw new Error(`Association N:N requires a joinTable in the association row`);
    }
}

/**
 * @class AssociationsParser
 */
export class AssociationsParser {

    private static associationsMetadata: IAssociationsParsed | undefined;

    /**
     * Parse associations file
     * @param {string} path
     * @returns {IAssociationsParsed}
     */
    static parse(tableNameDictionary: Dictionary<ITableName>, path: string): IAssociationsParsed {
        // Return cached value if already set
        if (this.associationsMetadata) {
            return this.associationsMetadata;
        }

        const associationsMetadata: IAssociationsParsed = {};

        const lines = fs.readFileSync(path)
            .toString()
            .split('\n')
            .filter(line => line.length); // Filter empty lines

        for (const line of lines) {
            const row = line
                .split(',')
                
                // Trim leading/trailing spaces for each field
                .map(t => t.trim())

                // Capitalize cardinality
                .map((t, i) => i === 0 ? t.toUpperCase() : t)

                // Treat optional empty fields as undefined
                .map((t, i) => i <= 4 || t != '' ? t : undefined) as AssociationRow;

            validateRow(row);

            const [
                cardinality,
                leftKey,
                rightKey,
                leftModelRaw,
                rightModelRaw,
                joinModelRaw,
                leftModelPropName,
                rightModelPropName,
            ] = row;

            const [
                leftCardinality,
                rightCardinality
            ] = cardinality.split(':');

            // Add entry for left table
            const leftModel = getTableName(tableNameDictionary, associationsMetadata, leftModelRaw);

            // Add entry for right table
            const rightModel = getTableName(tableNameDictionary, associationsMetadata, rightModelRaw);

            // 1:1 and 1:N association
            if (cardinality !== 'N:N' && !!leftModel?.fullTableName && !!rightModel?.fullTableName) {
                associationsMetadata[leftModel.fullTableName].associations.push({
                    associationName: rightCardinality === '1' ? 'HasOne' : 'HasMany',
                    targetModel: rightModel,
                    sourceKey: leftKey,
                    targetKey: rightKey,
                    targetAlias: rightModelPropName,
                    targetModelPropName: rightModelPropName,
                    hasMultipleForSameTarget: false
                });

                associationsMetadata[rightModel.fullTableName].associations.push({
                    associationName: 'BelongsTo',
                    targetModel: leftModel,
                    targetKey: rightKey,
                    targetAlias: leftModelPropName,
                    targetModelPropName: leftModelPropName,
                    hasMultipleForSameTarget: false
                });

                associationsMetadata[rightModel.fullTableName].foreignKeys.push({
                    name: rightKey,
                    targetModel: leftModel,
                    hasMultipleForSameTarget: false
                });
            }
            // N:N association
            else {
                // Add entry for join table
                const joinModel = getTableName(tableNameDictionary, associationsMetadata, joinModelRaw);

                if (!!leftModel?.fullTableName && !!rightModel?.fullTableName && !!joinModel?.fullTableName) {
                    associationsMetadata[leftModel.fullTableName].associations.push({
                        associationName: 'BelongsToMany',
                        targetModel: rightModel,
                        joinModel,
                        targetAlias: leftModelPropName,
                        targetModelPropName: rightModelPropName,
                        hasMultipleForSameTarget: false
                    });

                    associationsMetadata[rightModel.fullTableName].associations.push({
                        associationName: 'BelongsToMany',
                        targetModel: leftModel,
                        joinModel,
                        targetAlias: rightModelPropName,
                        targetModelPropName: leftModelPropName,
                        hasMultipleForSameTarget: false
                    });

                    associationsMetadata[joinModel.fullTableName].foreignKeys.push({
                        name: leftKey,
                        targetModel: leftModel,
                        hasMultipleForSameTarget: false
                    });

                    associationsMetadata[joinModel.fullTableName].foreignKeys.push({
                        name: rightKey,
                        targetModel: rightModel,
                        hasMultipleForSameTarget: false
                    });
                }
            }

        }

        // Add targetModelPropName for non-overridden/duplicated nav props
        for (const [fullTableName, association] of Object.entries(associationsMetadata)) {
            const associationGroups = groupBy(association.associations.filter(a => !a.targetModelPropName), x => `${x.associationName}~${x.targetModel.fullTableName}~${x.targetModelPropName}`);
            associationGroups.forEach(group => {
                if (group.length > 1) {
                    for (let i = 0; i < group.length; i++) {
                        const assoc = group[i];
                        const baseName = assoc.associationName.includes('Many')
                            ? pluralize.plural(assoc.targetModel.name)
                            : pluralize.singular(assoc.targetModel.name);
                        assoc.targetModelPropName = baseName + (i > 0 ? i : '');
                        assoc.hasMultipleForSameTarget = true;
                    }
                }
            });

            const foreignKeyGroups = groupBy(association.foreignKeys, x => x.targetModel.fullTableName);
            foreignKeyGroups.forEach(group => {
                if (group.length > 1) {
                    for (let i = 0; i < group.length; i++) {
                        group[i].hasMultipleForSameTarget = true;
                    }
                }
            });
        }

        // Cache result
        this.associationsMetadata = associationsMetadata;

        return this.associationsMetadata;
    }
}

function addModel(metadata: IAssociationsParsed, fullTableName?: string, error?: string) {
    if (!!fullTableName) {
        if (!metadata[fullTableName]) {
            metadata[fullTableName] = {
                foreignKeys: [],
                associations: [],
                errors: []
            };
        }

        if (!!error) {
            metadata[fullTableName].errors.push(error);
        }
    }
}

function getTableName(tableNameDictionary: Dictionary<ITableName>, associationsMetadata: IAssociationsParsed, rawModel?: string) {
    const modelParsed = parseFullTableName(rawModel?.toLowerCase());
    const model = !!modelParsed
        ? tableNameDictionary[modelParsed.fullTableName]
        : undefined;

    const unmatchedError = !model && !!rawModel
        ? `No table match found for association model: '${rawModel}'`
        : undefined;

    addModel(associationsMetadata, model?.fullTableName, unmatchedError);

    return model;
}