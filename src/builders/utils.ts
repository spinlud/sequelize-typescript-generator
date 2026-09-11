import * as ts from 'typescript';
import type { DataTypeNamespace, ISequelizeDataType } from '../dialects/dataTypes.js';

const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
});

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * A value that can be turned into a TypeScript expression: a primitive, an already
 * built compiler expression, an array of such values or a nested object literal.
 */
export type PropertyValue =
    | string
    | number
    | boolean
    | ts.Expression
    | PropertyValue[]
    | { [key: string]: PropertyValue };

/**
 * Returns string representation of typescript node
 * @param node
 * @returns {string}
 */
export const nodeToString = (node: ts.Node): string => {
    const sourceFile = ts.createSourceFile(
        `source.ts`,
        ``,
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.TS
    );

    const sourceCode = printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);

    // Typescript automatically escape non ASCII characters like 哈 or 😂. This is a workaround to render them properly.
    // Reference: https://github.com/microsoft/TypeScript/issues/36174
    return unescape(sourceCode.replace(/\\u/g, "%u"));
};

/**
 * Neutralise the block-comment terminator inside text so it cannot prematurely
 * close a JSDoc block, by inserting a space between `*` and `/`.
 * @param {string} comment
 * @returns {string}
 */
export const sanitiseJsDocComment = (comment: string): string => comment.replace(/\*\//g, '* /');

/**
 * Attach a database column comment as a `/** … *\/` JSDoc leading comment on a
 * declaration. Empty or whitespace-only comments are ignored; an embedded
 * comment terminator is neutralised first. Returns the node unchanged when there
 * is nothing to attach.
 * @param {T} node
 * @param {string | undefined} comment
 * @returns {T}
 */
export const attachColumnCommentJsDoc = <T extends ts.Node>(node: T, comment: string | undefined): T => {
    if (!comment || comment.trim().length === 0) {
        return node;
    }

    return ts.addSyntheticLeadingComment(
        node,
        ts.SyntaxKind.MultiLineCommentTrivia,
        `* ${sanitiseJsDocComment(comment.trim())} `,
        true
    );
};

/**
 * Generate named imports code (e.g. `import { Something, Else } from "module"`)
 * @param {string[]} importsSpecifier
 * @param {string} moduleSpecifier
 * @returns {string} Named import code
 */
export const generateNamedImports = (importsSpecifier: string[], moduleSpecifier: string): ts.ImportDeclaration => {
    return ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(
            undefined,
            undefined,
            ts.factory.createNamedImports(
                [
                    ...importsSpecifier
                        .map(is => ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(is)))
                ]
            )
        ),
        ts.factory.createStringLiteral(moduleSpecifier)
    );
};

/**
 * Generate a type-only named import (e.g. `import type { races } from "./races"`).
 * @param {string[]} importsSpecifier
 * @param {string} moduleSpecifier
 * @returns {ts.ImportDeclaration}
 */
export const generateTypeOnlyImport = (
    importsSpecifier: string[],
    moduleSpecifier: string
): ts.ImportDeclaration => {
    return ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(
            ts.SyntaxKind.TypeKeyword,
            undefined,
            ts.factory.createNamedImports(
                importsSpecifier.map(is =>
                    ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(is))
                )
            )
        ),
        ts.factory.createStringLiteral(moduleSpecifier)
    );
};

/**
 * Structural type guard for a compiler node, based on the fields every node carries.
 * @param {object} value
 * @returns {boolean}
 */
const isTsNode = (value: object): value is ts.Node =>
    'kind' in value && 'flags' in value && 'pos' in value && 'end' in value;

/**
 * Type guard for a compiler expression.
 * @param {unknown} value
 * @returns {boolean}
 */
export const isTsExpression = (value: unknown): value is ts.Expression =>
    typeof value === 'object' && value !== null && isTsNode(value) && ts.isExpression(value);

/**
 * Build a property name, quoting keys that are not valid identifiers.
 * @param {string} key
 * @returns {ts.PropertyName}
 */
const createPropertyName = (key: string): ts.PropertyName =>
    IDENTIFIER_PATTERN.test(key)
        ? ts.factory.createIdentifier(key)
        : ts.factory.createStringLiteral(key);

/**
 * Build a numeric literal expression, wrapping negatives in a unary minus.
 * @param {number} value
 * @returns {ts.Expression}
 */
const createNumericLiteralExpression = (value: number): ts.Expression =>
    value < 0
        ? ts.factory.createPrefixUnaryExpression(
            ts.SyntaxKind.MinusToken,
            ts.factory.createNumericLiteral(Math.abs(value))
        )
        : ts.factory.createNumericLiteral(value);

/**
 * Turn a property value into a compiler expression. Primitives become literals,
 * arrays become array literals, nested objects become object literals, and an
 * already built expression is returned unchanged.
 * @param {PropertyValue} value
 * @param {boolean} isMultiLine
 * @returns {ts.Expression}
 */
export const createPropertyValueExpression = (value: PropertyValue, isMultiLine: boolean): ts.Expression => {
    if (typeof value === 'string') {
        return ts.factory.createStringLiteral(value);
    }

    if (typeof value === 'number') {
        return createNumericLiteralExpression(value);
    }

    if (typeof value === 'boolean') {
        return value ? ts.factory.createTrue() : ts.factory.createFalse();
    }

    if (isTsExpression(value)) {
        return value;
    }

    if (Array.isArray(value)) {
        return ts.factory.createArrayLiteralExpression(
            value.map(item => createPropertyValueExpression(item, isMultiLine)),
            isMultiLine
        );
    }

    return buildObjectLiteralExpression(value, isMultiLine);
};

/**
 * Build an object literal expression from a plain record of property values.
 * @param {{ [key: string]: PropertyValue }} props
 * @param {boolean} isMultiLine
 * @returns {ts.ObjectLiteralExpression}
 */
export const buildObjectLiteralExpression = (
    props: { [key: string]: PropertyValue },
    isMultiLine: boolean
): ts.ObjectLiteralExpression =>
    ts.factory.createObjectLiteralExpression(
        Object.entries(props).map(([key, value]) =>
            ts.factory.createPropertyAssignment(
                createPropertyName(key),
                createPropertyValueExpression(value, isMultiLine)
            )
        ),
        isMultiLine
    );

/**
 * Build a type node from a JS type name: number/string/boolean/object/any keywords,
 * Date and Uint8Array references, and the unknown keyword for anything else. A name
 * with a trailing `[]` (e.g. `number[]`) yields an array type node of the element.
 * @param {string} jsType
 * @returns {ts.TypeNode}
 */
export const createTypeNodeFromName = (jsType: string): ts.TypeNode => {
    if (jsType.endsWith('[]')) {
        return ts.factory.createArrayTypeNode(createTypeNodeFromName(jsType.slice(0, -2)));
    }

    switch (jsType) {
        case 'number':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        case 'string':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
        case 'boolean':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
        case 'object':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.ObjectKeyword);
        case 'any':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
        case 'Date':
            return ts.factory.createTypeReferenceNode('Date', undefined);
        case 'Uint8Array':
            return ts.factory.createTypeReferenceNode('Uint8Array', undefined);
        default:
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    }
};

/**
 * Union a type node with the null literal type (e.g. `string | null`).
 * @param {ts.TypeNode} type
 * @returns {ts.TypeNode}
 */
export const createNullableTypeNode = (type: ts.TypeNode): ts.TypeNode =>
    ts.factory.createUnionTypeNode([
        type,
        ts.factory.createLiteralTypeNode(ts.factory.createNull()),
    ]);

/**
 * Build a generic type reference (e.g. `NonAttribute<Date>`). With no arguments a
 * bare type reference is produced.
 * @param {string} name
 * @param {ts.TypeNode[]} args
 * @returns {ts.TypeNode}
 */
export const createGenericTypeReference = (name: string, args: ts.TypeNode[]): ts.TypeNode =>
    ts.factory.createTypeReferenceNode(name, args.length > 0 ? args : undefined);

/**
 * Build an indexed access type node (e.g. `races["race_id"]`).
 * @param {string} modelName
 * @param {string} attribute
 * @returns {ts.TypeNode}
 */
export const createIndexedAccessTypeNode = (modelName: string, attribute: string): ts.TypeNode =>
    ts.factory.createIndexedAccessTypeNode(
        ts.factory.createTypeReferenceNode(modelName, undefined),
        ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(attribute))
    );

/**
 * Build a data type expression under the given namespace (e.g. `DataTypes.DECIMAL(7, 2)`
 * or `DataTypes.ENUM("AA", "BB")`).
 * @param {ISequelizeDataType} dataType
 * @param {DataTypeNamespace} namespace
 * @returns {ts.Expression}
 */
export const buildDataTypeExpression = (
    dataType: ISequelizeDataType,
    namespace: DataTypeNamespace
): ts.Expression => {
    const memberAccess = ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(namespace),
        ts.factory.createIdentifier(dataType.key)
    );

    if (dataType.args.length === 0) {
        return memberAccess;
    }

    return ts.factory.createCallExpression(
        memberAccess,
        undefined,
        dataType.args.map(arg => {
            if (typeof arg === 'number') {
                return createNumericLiteralExpression(arg);
            }

            if (typeof arg === 'string') {
                return ts.factory.createStringLiteral(arg);
            }

            return buildDataTypeExpression(arg, namespace);
        })
    );
};

/**
 * Generate model export for index file
 * @param {string} modelFileName
 * @returns {ts.ExportDeclaration}
 */
export const generateIndexExport = (modelFileName: string): ts.ExportDeclaration => {
    return ts.factory.createExportDeclaration(
        undefined,
        false,
        undefined,
        ts.factory.createStringLiteral(`./${modelFileName}`)
    );
};

/**
 * Generate object literal decorator
 * @param {string} decoratorIdentifier
 * @param {[key: string]: any} props
 * @return {ts.Decorator}
 */
export const generateObjectLiteralDecorator = (
    decoratorIdentifier: string,
    props: { [key: string]: any }
): ts.Decorator => {
    const _createPropertyAssignment = (propName: string, propValue: any): ts.PropertyAssignment => {
        let expression: ts.Expression;

        switch (typeof propValue) {
            case 'number':
                expression = ts.factory.createNumericLiteral(propValue);
                break;
            case 'string':
                if (propValue.startsWith('DataType.') || propValue.startsWith('Sequelize.')) {
                    expression = ts.factory.createIdentifier(propValue);
                }
                else {
                    expression = ts.factory.createStringLiteral(propValue);
                }
                break;
            case 'boolean':
                if (propValue) {
                    expression = ts.factory.createTrue();
                }
                else {
                    expression = ts.factory.createFalse();
                }
                break;
            default:
                expression = ts.factory.createIdentifier(propValue);
        }

        return ts.factory.createPropertyAssignment(propName, expression);
    }

    return ts.factory.createDecorator(
        ts.factory.createCallExpression(
            ts.factory.createIdentifier(decoratorIdentifier),
            undefined,
            [
                ts.factory.createObjectLiteralExpression(
                    [
                        ...Object.entries(props)
                            .map(e => _createPropertyAssignment(e[0], e[1]))
                    ]
                )
            ]
        )
    );
};

/**
 * Generate arrow decorator
 * @param {string} decoratorIdentifier
 * @param {string[]} arrowTargetIdentifiers
 * @param {object} objectLiteralProps
 * @returns {ts.Decorator}
 */
export const generateArrowDecorator = (
    decoratorIdentifier: string,
    arrowTargetIdentifiers: string[],
    objectLiteralProps?: object
): ts.Decorator => {
    const argumentsArray: ts.Expression[] = arrowTargetIdentifiers.map(t =>
        ts.factory.createArrowFunction(
            undefined,
            undefined,
            [],
            undefined,
            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            ts.factory.createIdentifier(t)
        ),
    );

    objectLiteralProps && argumentsArray.push(
        ts.factory.createObjectLiteralExpression([
            ...Object.entries(objectLiteralProps).map(e => {
                let initializer: ts.Expression;

                switch (typeof e[1]) {
                    case 'number':
                        initializer = ts.factory.createNumericLiteral(e[1]);
                        break;
                    case 'boolean':
                        initializer = e[1] ? ts.factory.createTrue() : ts.factory.createFalse();
                        break;
                    default:
                        initializer = ts.factory.createStringLiteral(e[1]);
                        break;
                }

                return ts.factory.createPropertyAssignment(e[0], initializer);
            }),
        ])
    );

    return ts.factory.createDecorator(
        ts.factory.createCallExpression(
            ts.factory.createIdentifier(decoratorIdentifier),
            undefined,
            argumentsArray
        )
    );
};
