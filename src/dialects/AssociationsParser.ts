import fs from 'fs';
import readline from 'readline';

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
    string?, // [join table]
    string?, // [left alias] - alias used by leftModel when referring to rightModel
    string? // [right alias] - alias used by rightModel when referring to leftModel
];

export interface IAssociationMetadata {
    associationName: 'HasOne' | 'HasMany' | 'BelongsTo' | 'BelongsToMany';
    targetModel: string;
    joinModel?: string;
    sourceKey?: string; // Left table key for HasOne and HasMany associations
    alias?: string; // Optional alias for the association
}

export interface IForeignKey {
    name: string;
    targetModel: string;
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
        joinTable,
        leftAlias,
        rightAlias
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

    // Validate aliases are not empty strings if provided
    if (leftAlias !== undefined && leftAlias.length === 0) {
        throw new Error(`Left alias cannot be empty string. Use undefined or omit the field instead.`);
    }

    if (rightAlias !== undefined && rightAlias.length === 0) {
        throw new Error(`Right alias cannot be empty string. Use undefined or omit the field instead.`);
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
                leftModel,
                rightModel,
                joinModel,
                leftAlias,
                rightAlias
            ] = row;

            const [
                leftCardinality,
                rightCardinality
            ] = cardinality.split(':');

            // Add entry for left table
            if (!associationsMetadata[leftModel]) {
                associationsMetadata[leftModel] = {
                    foreignKeys: [],
                    associations: [],
                };
            }

            // Add entry for right table
            if (!associationsMetadata[rightModel]) {
                associationsMetadata[rightModel] = {
                    foreignKeys: [],
                    associations: [],
                };
            }

            // 1:1 and 1:N association
            if (cardinality !== 'N:N') {
                // Left model association (HasOne/HasMany)
                associationsMetadata[leftModel].associations.push({
                    associationName: rightCardinality === '1' ? 'HasOne' : 'HasMany',
                    targetModel: rightModel,
                    sourceKey: leftKey,
                    ...(leftAlias && { alias: leftAlias })
                });

                // Right model association (BelongsTo)
                associationsMetadata[rightModel].associations.push({
                    associationName: 'BelongsTo',
                    targetModel: leftModel,
                    ...(rightAlias && { alias: rightAlias })
                });

                associationsMetadata[rightModel].foreignKeys.push({
                    name: rightKey,
                    targetModel: leftModel,
                });
            }
            // N:N association
            else {
                // Add entry for join table
                if (!associationsMetadata[joinModel!]) {
                    associationsMetadata[joinModel!] = {
                        foreignKeys: [],
                        associations: [],
                    };
                }

                // Left model BelongsToMany association
                associationsMetadata[leftModel].associations.push({
                    associationName: 'BelongsToMany',
                    targetModel: rightModel,
                    joinModel: joinModel,
                    ...(leftAlias && { alias: leftAlias })
                });

                // Right model BelongsToMany association
                associationsMetadata[rightModel].associations.push({
                    associationName: 'BelongsToMany',
                    targetModel: leftModel,
                    joinModel: joinModel,
                    ...(rightAlias && { alias: rightAlias })
                });

                associationsMetadata[joinModel!].foreignKeys.push({
                    name: leftKey,
                    targetModel: leftModel
                });

                associationsMetadata[joinModel!].foreignKeys.push({
                    name: rightKey,
                    targetModel: rightModel
                });
            }

        }

        // Cache result
        this.associationsMetadata = associationsMetadata;

        return this.associationsMetadata;
    }

}
