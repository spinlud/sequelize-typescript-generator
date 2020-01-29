import { IndexType, IndexMethod } from 'sequelize';
import { Case } from '../config/IConfig';
import { ITableMetadata } from './Dialect';
import {
    camelCase,
    constantCase,
    pascalCase,
    snakeCase,
} from "change-case";

export const toUpperCase = (s: string) => s.toUpperCase();
export const toLowerCase = (s: string) => s.toLowerCase();

/**
 * Return transformer for the provided case
 * @param  {Case} transformCase
 * @returns {function(s: string): string}
 */
export const getTransformer = (transformCase: Case): (s: string) => string => {
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
 * @param {Case} transformCase
 * @returns {ITableMetadata}
 */
export const caseTransformer = (tableMetadata: ITableMetadata, transformCase: Case): ITableMetadata => {
    const transformer = getTransformer(transformCase);

    const transformed: ITableMetadata = {
        name: tableMetadata.name,
        modelName: transformer(tableMetadata.name),
        timestamps: tableMetadata.timestamps,
        columns: [],
        comment: tableMetadata.comment,
    };

    for (const col of tableMetadata.columns) {
        transformed.columns.push(Object.assign({}, col, { name: transformer(col.name), fieldName: col.name }));
    }

    return transformed;
}
