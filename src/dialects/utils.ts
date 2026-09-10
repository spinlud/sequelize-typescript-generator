import { ITableMetadata, IColumnMetadata } from './Dialect.js';
import { TransformCase, TransformFn, TransformMap, TransformTarget } from '../config/IConfig.js';
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
        ...tableMetadata.schema !== undefined && { schema: tableMetadata.schema },
        ...tableMetadata.paranoid !== undefined && { paranoid: tableMetadata.paranoid },
        ...tableMetadata.hasTrigger !== undefined && { hasTrigger: tableMetadata.hasTrigger },
        ...tableMetadata.deletedAt !== undefined && {
            deletedAt: transformer(tableMetadata.deletedAt, TransformTarget.COLUMN),
        },
        ...tableMetadata.foreignKeys !== undefined && { foreignKeys: tableMetadata.foreignKeys },
        ...tableMetadata.associations && {
            associations: tableMetadata.associations.map(association => ({
                ...association,
                targetModel: transformer(association.targetModel, TransformTarget.MODEL),
                ...association.joinModel !== undefined && {
                    joinModel: transformer(association.joinModel, TransformTarget.MODEL),
                },
                ...association.sourceKey !== undefined && {
                    sourceKey: transformer(association.sourceKey, TransformTarget.COLUMN),
                },
                ...association.alias !== undefined && {
                    alias: transformer(association.alias, TransformTarget.COLUMN),
                },
                ...association.foreignKey !== undefined && {
                    foreignKey: transformer(association.foreignKey, TransformTarget.COLUMN),
                },
                ...association.targetKey !== undefined && {
                    targetKey: transformer(association.targetKey, TransformTarget.COLUMN),
                },
            }))
        },
        comment: tableMetadata.comment,
    };

    for (const [columnName, columnMetadata] of Object.entries(tableMetadata.columns)) {
        const transformedColumn: IColumnMetadata = {
            ...columnMetadata,
            name: transformer(columnMetadata.originName, TransformTarget.COLUMN),
            ...columnMetadata.foreignKey && {
                foreignKey: {
                    ...columnMetadata.foreignKey,
                    name: transformer(columnMetadata.foreignKey.name, TransformTarget.COLUMN),
                    targetModel: transformer(columnMetadata.foreignKey.targetModel, TransformTarget.MODEL),
                    ...columnMetadata.foreignKey.targetKey !== undefined && {
                        targetKey: transformer(columnMetadata.foreignKey.targetKey, TransformTarget.COLUMN),
                    },
                },
            },
        };

        transformed.columns[columnName] = transformedColumn;
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
