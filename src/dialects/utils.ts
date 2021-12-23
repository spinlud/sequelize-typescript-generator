import { ITableMetadata } from './Dialect';
import { TransformCase, TransformFn, TransformMap, TransformTarget } from '../config/IConfig';
import { camelCase, constantCase, pascalCase, snakeCase } from "change-case";

type CaseTransformer = (s: string) => string;

export const toUpperCase = (s: string) => s.toUpperCase();
export const toLowerCase = (s: string) => s.toLowerCase();

/**
 * Check if provided string is ASCII
 * @param {string} s
 * @returns {boolean}
 */
export const isASCII = (s: string): boolean => (/^[\x00-\xFF]*$/).test(s);

/**
 * Get transformer for case
 * @param {TransformCase} transformCase
 * @returns {CaseTransformer}
 */
const getTransformerForCase = (transformCase: TransformCase): CaseTransformer => {
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

    return transformer;
}

/**
 * Wrapper for case transformer. Returns unprocessed string for non ASCII characters
 * @param {TransformCase | TransformMap} transformCase
 * @returns {TransformFn}
 */
export const transformerFactory = (transformCase: TransformCase | TransformMap): TransformFn => {
    let modelTransformer: CaseTransformer;
    let columnTransformer: CaseTransformer;

    if (typeof transformCase === 'string') {
        const transformer = getTransformerForCase(transformCase as TransformCase);
        modelTransformer = transformer;
        columnTransformer = transformer;
    }
    else {
        modelTransformer = getTransformerForCase(transformCase.model);
        columnTransformer = getTransformerForCase(transformCase.column);
    }

    return function(value: string, target: TransformTarget) {
        if (!isASCII(value)) {
            console.warn(`Unsupported case transformation for non ASCII characters:`, value);
            return value;
        }

        if (target === TransformTarget.MODEL) {
            return modelTransformer(value);
        }

        return columnTransformer(value);
    }
};

/**
 * Get transformer
 * @param {TransformCase | TransformMap | TransformFn} transformCase
 * @returns {TransformFn}
 */
export const getTransformer = (transformCase: TransformCase | TransformMap | TransformFn): TransformFn => {
    if (typeof transformCase === 'function') {
        return transformCase;
    }

    return transformerFactory(transformCase);
}

/**
 * Transform ITableMetadata object using the provided case
 * @param {ITableMetadata} tableMetadata
 * @param {TransformCase} transformCase
 * @returns {ITableMetadata}
 */
export const caseTransformer = (
    tableMetadata: ITableMetadata,
    transformCase: TransformCase | TransformMap | TransformFn
): ITableMetadata => {

    const transformer: TransformFn = getTransformer(transformCase);

    const transformed: ITableMetadata = {
        originName: tableMetadata.originName,
        name: transformer(tableMetadata.originName, TransformTarget.MODEL),
        timestamps: tableMetadata.timestamps,
        columns: {},
        ...tableMetadata.associations && {
            associations: tableMetadata.associations.map(a => {
                a.targetModel = transformer(a.targetModel, TransformTarget.MODEL);

                if (a.joinModel) {
                    a.joinModel = transformer(a.joinModel, TransformTarget.MODEL);
                }

                if (a.sourceKey) {
                    a.sourceKey = transformer(a.sourceKey, TransformTarget.COLUMN);
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
                name: transformer(name, TransformTarget.COLUMN),
                targetModel: transformer(targetModel, TransformTarget.MODEL),
            }
        }

        transformed.columns[columnName] =  Object.assign(
            {},
            columnMetadata,
            { name: transformer(columnMetadata.originName, TransformTarget.COLUMN) }
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
