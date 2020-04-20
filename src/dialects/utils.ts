import { TransformCase, TransformFunction, TransformType, TransformCollection } from '../config/IConfig';
import { ITableMetadata } from './Dialect';
import {
    camelCase,
    constantCase,
    pascalCase,
    snakeCase,
} from "change-case";

export const toUpperCase = (s: string) => s.toUpperCase();
export const toLowerCase = (s: string) => s.toLowerCase();

const getPredicateForCase = (transformCase: TransformCase) => {
    let predicate: (s: string) => string;

    switch(transformCase) {
        case "CAMEL":
            predicate = camelCase;
            break;
        case "UPPER":
            predicate = toUpperCase;
            break;
        case "LOWER":
            predicate = toLowerCase;
            break;
        case "PASCAL":
            predicate = pascalCase;
            break;
        case "UNDERSCORE":
            predicate = snakeCase;
            break;
        case "CONST":
            predicate = constantCase;
            break;
        default:
            predicate = (s: string) => s;
    }

    return predicate;
}

/**
 * Return transformer for the provided case
 * @param  {TransformCase | TransformCollection | TransformFunction} transformCase
 * @returns {function(s: string, type: TransformType): string}
 */
export const getTransformer = (transformCase: TransformCase | TransformCollection | TransformFunction): TransformFunction => {
    if(typeof transformCase === "function") {
        return transformCase as TransformFunction;
    }
    if(typeof transformCase === "object") {
        return (value: string, type: TransformType) => {
            return getPredicateForCase(transformCase[type])(value);
        }
    }
    return getPredicateForCase(transformCase);
};

/**
 * Transform ITableMetadata object using the provided case
 * @param {ITableMetadata} tableMetadata
 * @param {TransformCase} transformCase
 * @returns {ITableMetadata}
 */
export const caseTransformer = (
    tableMetadata: ITableMetadata,
    transformCase: TransformCase | TransformCollection | TransformFunction
): ITableMetadata => {

    const transformer = getTransformer(transformCase);

    const transformed: ITableMetadata = {
        originName: tableMetadata.originName,
        name: transformer(tableMetadata.originName, TransformType.MODEL),
        timestamps: tableMetadata.timestamps,
        columns: {},
        ...tableMetadata.associations && {
            associations: tableMetadata.associations.map(a => {
                a.targetModel = transformer(a.targetModel, TransformType.MODEL);

                if (a.joinModel) {
                    a.joinModel = transformer(a.joinModel, TransformType.MODEL);
                }

                if (a.sourceKey) {
                    a.sourceKey = transformer(a.sourceKey, TransformType.COLUMN);
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
                name: transformer(name, TransformType.COLUMN),
                targetModel: transformer(targetModel, TransformType.MODEL),
            }
        }

        transformed.columns[columnName] =  Object.assign(
            {},
            columnMetadata,
            { name: transformer(columnMetadata.originName, TransformType.COLUMN) }
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
