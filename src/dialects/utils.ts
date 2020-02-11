import { TransformCase } from '../config/IConfig';
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
        ...tableMetadata.associations && {
            associations: tableMetadata.associations.map(a => {
                a.targetModel = transformer(a.targetModel);

                if (a.joinModel) {
                    a.joinModel = transformer(a.joinModel);
                }

                return a;
            })
        },
        comment: tableMetadata.comment,
    };

    for (const [columnName, columnMetadata] of Object.entries(tableMetadata.columns)) {

        if (columnMetadata.foreignKey) {
            const { name, targetModel } = columnMetadata.foreignKey;

            columnMetadata.foreignKey = {
                name: transformer(name),
                targetModel: transformer(targetModel),
            }
        }

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
