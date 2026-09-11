import { DataTypes } from 'sequelize';
import type { AbstractDataTypeConstructor } from 'sequelize';

export type SequelizeDataTypeKey = keyof typeof DataTypes;

/**
 * A single argument of a Sequelize data type. A scalar argument is a number
 * (precision, length) or a string (ENUM value); a nested argument is itself a
 * data type, so an argument list can carry another data type such as the element
 * type of `ARRAY(INTEGER)`.
 */
export type DataTypeArgument = string | number | ISequelizeDataType;

/**
 * Format-neutral Sequelize data type: a DataTypes key plus its arguments. Scalar
 * arguments render bare (numbers) or single-quoted (strings, for ENUM values); a
 * nested data type argument renders as its own data type expression.
 */
export interface ISequelizeDataType {
    key: SequelizeDataTypeKey;
    args: DataTypeArgument[];
}

/**
 * Type guard for a nested data type argument.
 * @param {DataTypeArgument} arg
 * @returns {boolean}
 */
export const isNestedDataType = (arg: DataTypeArgument): arg is ISequelizeDataType =>
    typeof arg === 'object' && arg !== null && 'key' in arg && 'args' in arg;

/**
 * Namespaces under which a data type expression is rendered.
 */
export const DATA_TYPE_NAMESPACES = {
    decorators: 'DataType',
    native: 'DataTypes',
} as const;

export type DataTypeNamespace = typeof DATA_TYPE_NAMESPACES[keyof typeof DATA_TYPE_NAMESPACES];

/**
 * Type guard for a Sequelize DataTypes key.
 * @param {string} value
 * @returns {boolean}
 */
export const isSequelizeDataTypeKey = (value: string): value is SequelizeDataTypeKey =>
    Object.prototype.hasOwnProperty.call(DataTypes, value);

/**
 * Resolve the DataTypes key for a constructor. The first token of the constructor
 * key is used so that 'DOUBLE PRECISION' resolves to 'DOUBLE'. Returns undefined when
 * the first token is not a DataTypes member.
 * @param {AbstractDataTypeConstructor} ctor
 * @returns {SequelizeDataTypeKey | undefined}
 */
export const resolveSequelizeDataTypeKey = (
    ctor: AbstractDataTypeConstructor
): SequelizeDataTypeKey | undefined => {
    const [firstToken] = ctor.key.split(' ');

    return isSequelizeDataTypeKey(firstToken) ? firstToken : undefined;
};

/**
 * Build a format-neutral Sequelize data type from a constructor and its arguments.
 * Falsy arguments (null, undefined, 0, empty string) are dropped, matching the
 * precision signature behaviour. Returns undefined when the constructor key does not
 * resolve to a DataTypes member.
 * @param {AbstractDataTypeConstructor} ctor
 * @param {Array<DataTypeArgument | null | undefined>} args
 * @returns {ISequelizeDataType | undefined}
 */
export const buildSequelizeDataType = (
    ctor: AbstractDataTypeConstructor,
    args: Array<DataTypeArgument | null | undefined>
): ISequelizeDataType | undefined => {
    const key = resolveSequelizeDataTypeKey(ctor);

    if (key === undefined) {
        return undefined;
    }

    const filteredArgs: DataTypeArgument[] = [];

    for (const arg of args) {
        if (arg) {
            filteredArgs.push(arg);
        }
    }

    return { key, args: filteredArgs };
};

/**
 * Render a single data type argument. Numbers render bare; strings render
 * single-quoted with internal single quotes doubled; a nested data type renders
 * as its own expression under the same namespace.
 * @param {DataTypeArgument} arg
 * @param {DataTypeNamespace} namespace
 * @returns {string}
 */
const renderDataTypeArgument = (arg: DataTypeArgument, namespace: DataTypeNamespace): string => {
    if (typeof arg === 'number') {
        return String(arg);
    }

    if (typeof arg === 'string') {
        return `'${arg.replace(/'/g, "''")}'`;
    }

    return renderDataTypeExpression(arg, namespace);
};

/**
 * Render a data type expression, e.g. DataType.DECIMAL(7,3), DataTypes.ENUM('AA','BB')
 * or DataTypes.ARRAY(DataTypes.INTEGER).
 * @param {ISequelizeDataType} dataType
 * @param {DataTypeNamespace} namespace
 * @returns {string}
 */
export const renderDataTypeExpression = (
    dataType: ISequelizeDataType,
    namespace: DataTypeNamespace
): string => {
    const signature = dataType.args.length
        ? `(${dataType.args.map(arg => renderDataTypeArgument(arg, namespace)).join(',')})`
        : '';

    return `${namespace}.${dataType.key}${signature}`;
};

/**
 * Parse the value list of an enum column type, e.g. "enum('AA','BB')" -> ['AA', 'BB'].
 * Doubled single quotes are unescaped. Returns an empty array when there is no list.
 * @param {string} columnType
 * @returns {string[]}
 */
export const parseEnumValues = (columnType: string): string[] => {
    if (!columnType.trim().toLowerCase().startsWith('enum')) {
        return [];
    }

    const match = columnType.match(/\((.*)\)/);

    if (!match) {
        return [];
    }

    const [, inner] = match;
    const values: string[] = [];
    let current = '';
    let isInsideQuotes = false;

    for (let index = 0; index < inner.length; index++) {
        const char = inner[index];

        if (char === "'") {
            if (isInsideQuotes && inner[index + 1] === "'") {
                current += "'";
                index++;
            }
            else {
                isInsideQuotes = !isInsideQuotes;
            }
        }
        else if (char === ',' && !isInsideQuotes) {
            values.push(current);
            current = '';
        }
        else {
            current += char;
        }
    }

    if (current.length || values.length) {
        values.push(current);
    }

    return values;
};
