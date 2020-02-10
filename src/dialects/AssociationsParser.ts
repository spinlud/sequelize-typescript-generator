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
    string? // [join table]
];

export interface IAssociationMetadata {
    associationName: 'HasOne' | 'HasMany' | 'BelongsTo' | 'BelongsToMany';
    targetTable: string;
    joinTable?: string;
}

export interface IAssociationsParsed {
    [tableName: string]: {
        foreignKeys: string[];
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
                leftkey,
                rightKey,
                leftTable,
                rightTable,
                joinTable
            ] = row;

            const [
                leftCardinality,
                rightCardinality
            ] = cardinality.split(':');

            // Add entry for left table
            if (!associationsMetadata[leftTable]) {
                associationsMetadata[leftTable] = {
                    foreignKeys: [],
                    associations: [],
                };
            }

            // Add entry for right table
            if (!associationsMetadata[rightTable]) {
                associationsMetadata[rightTable] = {
                    foreignKeys: [],
                    associations: [],
                };
            }

            // 1:1 and 1:N association
            if (cardinality !== 'N:N') {
                associationsMetadata[leftTable].associations.push({
                    associationName: rightCardinality === '1' ? 'HasOne' : 'HasMany',
                    targetTable: rightTable
                });

                associationsMetadata[rightTable].foreignKeys.push(rightKey);

                associationsMetadata[rightTable].associations.push({
                    associationName: 'BelongsTo',
                    targetTable: leftTable
                });
            }
            // N:N association
            else {
                // Add entry for join table
                if (!associationsMetadata[joinTable!]) {
                    associationsMetadata[joinTable!] = {
                        foreignKeys: [],
                        associations: [],
                    };
                }

                associationsMetadata[leftTable].associations.push({
                    associationName: 'BelongsToMany',
                    targetTable: rightTable,
                    joinTable: joinTable,
                });

                associationsMetadata[rightTable].associations.push({
                    associationName: 'BelongsToMany',
                    targetTable: leftTable,
                    joinTable: joinTable,
                });

                associationsMetadata[joinTable!].foreignKeys.push(...[leftkey, rightKey]);
            }

        }

        // Cache result
        this.associationsMetadata = associationsMetadata;

        return this.associationsMetadata;
    }

}
