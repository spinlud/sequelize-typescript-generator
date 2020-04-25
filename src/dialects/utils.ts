import { TransformCase } from '../config/IConfig';
import { ITableMetadata } from './Dialect';
import {
    camelCase,
    constantCase,
    pascalCase,
    snakeCase,
} from "change-case";

export type CaseTransformer = (s: string) => string;

export const toUpperCase = (s: string) => s.toUpperCase();
export const toLowerCase = (s: string) => s.toLowerCase();

/**
 * Check if provided string is ASCII
 * @param {string} s
 * @returns {boolean}
 */
export const isASCII = (s: string): boolean => (/^[\x00-\xFF]*$/).test(s);

/**
 * Wrapper for case transformer. Returns unprocessed string for non ASCII characters
 * @param {CaseTransformer} transformer
 * @returns {CaseTransformer}
 */
export const transformerFactory = (transformer: CaseTransformer): CaseTransformer => {
    return function(s: string) {
        if (!isASCII(s)) {
            console.warn(`Unsupported case transformation for non ASCII characters:`, s);
            return s;
        }

        return transformer(s);
    }
};

/**
 * Return transformer for the provided case
 * @param  {TransformCase} transformCase
 * @returns {function(s: string): string}
 */
export const getTransformer = (transformCase: TransformCase): (s: string) => string => {
    let transformer: CaseTransformer;

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

    return transformerFactory(transformer);
};

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

                if (a.sourceKey) {
                    a.sourceKey = transformer(a.sourceKey);
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
};

/**
 * Unknown mapping warning
 * @param {string} dataType
 * @returns {string}
 */
export const warnUnknownMappingForDataType = (dataType: string) => {
    console.warn(`[Warning]`,
        `Unknown data type mapping for type '${dataType}'. 
        You should define the data type manually.     
    `);
};

/**
 * Generates precision signature
 * @param {Array<string|number>} args
 * @returns {string} (80) or (10,4) or ...
 */
export const generatePrecisionSignature = (...args: Array<string|number|undefined|null>): string => {
    const tokens = args.filter(arg => !!arg);

    return tokens.length ? `(${tokens.join(',')})` : '';
};
