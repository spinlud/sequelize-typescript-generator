import * as ts from 'typescript';

const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
});

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
 * Generate named imports code (e.g. `import { Something, Else } from "module"`)
 * @param {string[]} importsSpecifier
 * @param {string} moduleSpecifier
 * @returns {string} Named import code
 */
export const generateNamedImports = (importsSpecifier: string[], moduleSpecifier: string): ts.ImportDeclaration => {
    return ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(
            false,
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
