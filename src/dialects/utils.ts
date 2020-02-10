import fs from 'fs';
import readline from 'readline';
import { TransformCase } from '../config/IConfig';
import { ITableMetadata } from './Dialect';
import {
    camelCase,
    constantCase,
    pascalCase,
    snakeCase,
} from "change-case";

interface IAssociations {
    [tableName: string]: {
        foreignKeys?: {
            [columnName: string]: { target: string; }
        },
        associations: [
            {
                name: string; // 'books'
                type: string; // 'BelongsToMany',
                targets: string[]; // ['Book', 'BookAuthor']
            }
        ]
    }
}

export const toUpperCase = (s: string) => s.toUpperCase();
export const toLowerCase = (s: string) => s.toLowerCase();

/**
 * Return transformer for the provided case
 * @param  {TransformCase} transformCase
 * @returns {function(s: string): string}
 */
export const getTransformer = (transformCase: TransformCase): (s: string) => string => {
    let transformer: (s: string) => string;

    switch(transformCase) {
        case "CAMEL":
            transformer = camelCase;
            break;
        case "UPPER":
            transformer = toUpperCase;
            break;
        case "LOWER":
            transformer = toLowerCase;
            break;
        case "PASCAL":
            transformer = pascalCase;
            break;
        case "UNDERSCORE":
            transformer = snakeCase;
            break;
        case "CONST":
            transformer = constantCase;
            break;
        default:
            transformer = (s: string) => s;
    }

    return transformer;
}

/**
 * Transform ITableMetadata object using the provided case
 * @param {ITableMetadata} tableMetadata
 * @param {TransformCase} transformCase
 * @returns {ITableMetadata}
 */
export const caseTransformer = (
    tableMetadata: ITableMetadata,
    transformCase: TransformCase
): ITableMetadata => {

    const transformer = getTransformer(transformCase);

    const transformed: ITableMetadata = {
        originName: tableMetadata.originName,
        name: transformer(tableMetadata.originName),
        timestamps: tableMetadata.timestamps,
        columns: {},
        comment: tableMetadata.comment,
    };

    for (const [columnName, columnMetadata] of Object.entries(tableMetadata.columns)) {
        transformed.columns[columnName] =  Object.assign(
            {},
            columnMetadata,
            { name: transformer(columnMetadata.originName) }
        );
    }

    return transformed;
}

/**
 *
 * @param dataType
 */
export const warnUnknownMappingForDataType = (dataType: string) => {
    console.warn(`[Warning]`,
`Unknown data type mapping for type '${dataType}'. 
        You should define the data type manually.     
    `);
}


export const associationsParser = (path: string): Promise<any> => {

    const _parse = () => new Promise(resolve => {
        const readInterface = readline.createInterface({
            input: fs.createReadStream(path),
            output: process.stdout
        });

        // Parse line
        readInterface.on('line', line => {
            const tokens = line.split(',').map(t => t.trim());

            // Validate line
        });

        readInterface.on('close', () => {
            return resolve();
        });
    });

    return _parse()
};
