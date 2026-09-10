import * as ts from 'typescript';
import type { DataTypeNamespace } from '../dialects/dataTypes.js';

/**
 * Namespace-neutral description of a column default value. A `dataTypeMember`
 * carries only the member name (e.g. `NOW`) so the target namespace is chosen at
 * render time; a `sqlLiteral` carries the unescaped SQL passed to Sequelize.literal.
 */
export type DefaultValueDescriptor =
    | { kind: 'dataTypeMember'; member: string }
    | { kind: 'sqlLiteral'; sql: string }
    | { kind: 'number'; value: number }
    | { kind: 'boolean'; value: boolean }
    | { kind: 'string'; value: string };

const DATA_TYPE_MEMBER_PATTERN = /^DataType\.([A-Za-z0-9_]+)$/;
const SQL_LITERAL_PATTERN = /^Sequelize\.literal\("([\s\S]*)"\)$/;

/**
 * Parse a decorators-spelled default value into a namespace-neutral descriptor.
 * `DataType.NOW` becomes a data type member, `Sequelize.literal("...")` becomes a
 * SQL literal with its double quotes unescaped, numbers and booleans pass through,
 * and any other string becomes a quoted string. Returns undefined for a missing default.
 * @param {unknown} raw
 * @returns {DefaultValueDescriptor | undefined}
 */
export const parseDefaultValue = (raw: unknown): DefaultValueDescriptor | undefined => {
    if (typeof raw === 'number') {
        return { kind: 'number', value: raw };
    }

    if (typeof raw === 'boolean') {
        return { kind: 'boolean', value: raw };
    }

    if (typeof raw === 'string') {
        const memberMatch = raw.match(DATA_TYPE_MEMBER_PATTERN);

        if (memberMatch) {
            const [, member] = memberMatch;
            return { kind: 'dataTypeMember', member };
        }

        const literalMatch = raw.match(SQL_LITERAL_PATTERN);

        if (literalMatch) {
            const [, sql] = literalMatch;
            return { kind: 'sqlLiteral', sql: sql.replace(/\\"/g, '"') };
        }

        return { kind: 'string', value: raw };
    }

    return undefined;
};

/**
 * Build a compiler expression for a default value descriptor. Data type members
 * render under the given namespace; SQL literals always render through Sequelize.literal.
 * @param {DefaultValueDescriptor} descriptor
 * @param {DataTypeNamespace} namespace
 * @returns {ts.Expression}
 */
export const buildDefaultValueExpression = (
    descriptor: DefaultValueDescriptor,
    namespace: DataTypeNamespace
): ts.Expression => {
    switch (descriptor.kind) {
        case 'dataTypeMember':
            return ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(namespace),
                ts.factory.createIdentifier(descriptor.member)
            );
        case 'sqlLiteral':
            return ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier('Sequelize'),
                    ts.factory.createIdentifier('literal')
                ),
                undefined,
                [ts.factory.createStringLiteral(descriptor.sql)]
            );
        case 'number':
            return descriptor.value < 0
                ? ts.factory.createPrefixUnaryExpression(
                    ts.SyntaxKind.MinusToken,
                    ts.factory.createNumericLiteral(Math.abs(descriptor.value))
                )
                : ts.factory.createNumericLiteral(descriptor.value);
        case 'boolean':
            return descriptor.value ? ts.factory.createTrue() : ts.factory.createFalse();
        case 'string':
            return ts.factory.createStringLiteral(descriptor.value);
    }
};
