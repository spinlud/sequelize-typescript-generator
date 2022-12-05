import { ITableMetadata, ITableName } from './Dialect';
import { TransformCase, TransformFn, TransformMap, TransformTarget } from '../config/IConfig';
import { camelCase, constantCase, pascalCase, snakeCase } from 'change-case/dist';
import { Optional } from 'sequelize';

export const noSchemaPrefix = 'noschema.';

export type Dictionary<T> = {[key: string]: T};
export type ObjDictionary = Dictionary<{}>;
export type StringDictionary = Dictionary<string>;

type CaseTransformer = (s: string) => string;

/**
 * @description
 * Takes an Array<V>, and a grouping function,
 * and returns a Map of the array grouped by the grouping function.
 *
 * @param list An array of type V.
 * @param keyGetter A Function that takes the the Array type V as an input, and returns a value of type K.
 *                  K is generally intended to be a property key of V.
 *
 * @returns Map of the array grouped by the grouping function.
 */
export const groupBy = <K, V>(list: Array<V>, keyGetter: (input: V) => K): Map<K, Array<V>> => {
    const map = new Map();
    list.forEach((item) => {
         const key = keyGetter(item);
         const collection = map.get(key);
         if (!collection) {
             map.set(key, [item]);
         } else {
             collection.push(item);
         }
    });
    return map;
}

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
 * Transform ITableName
 * @param {TransformFn} transformer
 * @param {ITableName} tableName
 * @returns {ITableName}
 */
const transformTableName = (transformer: TransformFn, tableName: Optional<ITableName, 'fullTableName'>): ITableName => {
    return {
        ...decorateFullTableName({
            name: transformer(tableName.name, TransformTarget.MODEL),
            schema: tableName.schema
        })
    };
};

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
        ...transformTableName(transformer, {
            name: tableMetadata.originName,
            schema: tableMetadata.schema
        }),
        timestamps: tableMetadata.timestamps,
        columns: {},
        ...tableMetadata.associations && {
            associations: tableMetadata.associations.map(a => {
                a.targetModel = transformTableName(transformer, a.targetModel);

                if (a.joinModel) {
                    a.joinModel = transformTableName(transformer, a.joinModel);
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
            const { name, targetModel, hasMultipleForSameTarget } = columnMetadata.foreignKey;

            columnMetadata.foreignKey = {
                name: transformer(name, TransformTarget.COLUMN),
                targetModel: transformTableName(transformer, targetModel),
                hasMultipleForSameTarget
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

/**
 * Generates ITableName from raw string
 * @param {string} fullTableName 'Customers' or 'dbo.Customers' or '[xyz].Customers'
 * @returns {ITableName}
 */
export const parseFullTableName = (fullTableName?: string, schemaSeparator: string = '.'): ITableName|undefined => {
    if (!fullTableName) {
        return undefined;
    }
    const splitUp = fullTableName.replace(/\[|\]/g, '').split(schemaSeparator);
    splitUp.reverse();
    const temp = {
        name: splitUp[0],
        schema: splitUp.length > 1 ? splitUp[1] : '',
    };
    const result = decorateFullTableName(temp, schemaSeparator);
    return result;
}

/**
 * Returns the full table name with the rest of the ITableName values passed in
 * @param {Partial<ITableName>} table
 * @returns {ITableName}
 */
export const decorateFullTableName = (table: Partial<ITableName>, schemaSeparator: string = '.'): ITableName => {
    const schemaPrefix = !!table.schema ? table.schema + schemaSeparator : '';
    return {
        ...table,
        fullTableName: schemaPrefix + table.name
    } as ITableName;
}

export const populateFullTableNameDictionary = (tables: ITableName[], dictionary: ObjDictionary) => {
    tables.forEach(t => {
        const {name, fullTableName, schema} = t;
        const tableName: ITableName = {
            name, fullTableName, schema
        };

        dictionary[t.fullTableName] = tableName;
        dictionary[t.fullTableName.toLowerCase()] = tableName;
        const loweredName = t.name.toLowerCase();
        if (tables.filter(a => a.name.toLowerCase() == loweredName).length === 1) {
            // only 1 table has this name, regardless of schema
            dictionary[loweredName] = tableName;
            dictionary[noSchemaPrefix + loweredName] = tableName;
        }
    });
}
