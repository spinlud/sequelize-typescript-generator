import fs from 'fs';
import { ITableName } from './Dialect';
import { parseFullTableName } from './utils';

const cardinalities = new Set([
    '1:1',
    '1:N',
    'N:N'
]);

type AssociationRow = [
    string, // cardinality
    string, // left key
    string, // right key
    string, // left table
    string, // right table
    string? // [join table]
];

export interface IAssociationMetadata {
    associationName: 'HasOne' | 'HasMany' | 'BelongsTo' | 'BelongsToMany';
    targetModel: ITableName;
    joinModel?: ITableName;
    sourceKey?: string; // Left table key for HasOne and HasMany associations
}

export interface IForeignKey {
    name: string;
    targetModel: ITableName;
}

export interface IAssociationsParsed {
    [tableName: string]: {
        foreignKeys: IForeignKey[];
        associations: IAssociationMetadata[];
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
    static parse(path: string): IAssociationsParsed {
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
                .map((t, i) => i === 0 ? t.toUpperCase() : t) // Capitalize cardinality
                .map(t => t.trim()) as AssociationRow;

            validateRow(row);

            const [
                cardinality,
                leftKey,
                rightKey,
                leftModelRaw,
                rightModelRaw,
                joinModelRaw
            ] = row;

            const leftModel = parseFullTableName(leftModelRaw);
            const rightModel = parseFullTableName(rightModelRaw);
            
            const [
                leftCardinality,
                rightCardinality
            ] = cardinality.split(':');
            
            // Add entry for left table
            addModel(associationsMetadata, leftModel?.fullTableName);
            
            // Add entry for right table
            addModel(associationsMetadata, rightModel?.fullTableName);
            
            // 1:1 and 1:N association
            if (cardinality !== 'N:N' && !!leftModel?.fullTableName && !!rightModel?.fullTableName) {
                associationsMetadata[leftModel.fullTableName].associations.push({
                    associationName: rightCardinality === '1' ? 'HasOne' : 'HasMany',
                    targetModel: rightModel,
                    sourceKey: leftKey,
                });

                associationsMetadata[rightModel.fullTableName].associations.push({
                    associationName: 'BelongsTo',
                    targetModel: leftModel,
                });

                associationsMetadata[rightModel.fullTableName].foreignKeys.push({
                    name: rightKey,
                    targetModel: leftModel,
                });
            }
            // N:N association
            else {
                // Add entry for join table
                const joinModel = parseFullTableName(joinModelRaw);
                addModel(associationsMetadata, joinModel?.fullTableName);

                if (!!leftModel?.fullTableName && !!rightModel?.fullTableName && !!joinModel?.fullTableName) {
                    associationsMetadata[leftModel.fullTableName].associations.push({
                        associationName: 'BelongsToMany',
                        targetModel: rightModel,
                        joinModel,
                    });

                    associationsMetadata[rightModel.fullTableName].associations.push({
                        associationName: 'BelongsToMany',
                        targetModel: leftModel,
                        joinModel,
                    });

                    associationsMetadata[joinModel.fullTableName].foreignKeys.push({
                        name: leftKey,
                        targetModel: leftModel,
                    });

                    associationsMetadata[joinModel.fullTableName].foreignKeys.push({
                        name: rightKey,
                        targetModel: rightModel,
                    });
                }
            }

        }

        // Cache result
        this.associationsMetadata = associationsMetadata;

        return this.associationsMetadata;
    }
}

function addModel(metadata: IAssociationsParsed, fullTableName?: string) {
    if (!!fullTableName && !metadata[fullTableName]) {
        metadata[fullTableName] = {
            foreignKeys: [],
            associations: [],
        };
    }
}