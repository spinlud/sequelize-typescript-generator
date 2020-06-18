import * as ts from 'typescript';

const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});

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

    return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
};

/**
 * Generate named imports code (e.g. `import { Something, Else } from "module"`)
 * @param {string[]} importsSpecifier
 * @param {string} moduleSpecifier
 * @returns {string} Named import code
 */
export const generateNamedImports = (importsSpecifier: string[], moduleSpecifier: string): ts.ImportDeclaration => {
    return ts.createImportDeclaration(
        /* decorators */ undefined,
        /* modifiers */ undefined,
        ts.createImportClause(
            undefined,
            ts.createNamedImports(
                [
                    ...importsSpecifier
                        .map(is => ts.createImportSpecifier(undefined, ts.createIdentifier(is)))
                ]
            )
        ),
        ts.createLiteral(moduleSpecifier)
    );
};

/**
 * Generate model export for index file
 * @param {string} modelFileName
 * @returns {ts.ExportDeclaration}
 */
export const generateIndexExport = (modelFileName: string): ts.ExportDeclaration => {
    return ts.createExportDeclaration(
        [],
        undefined,
        undefined,
        ts.createLiteral(`./${modelFileName}`)
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
    return ts.createDecorator(
        ts.createCall(
            ts.createIdentifier(decoratorIdentifier),
            undefined,
            [
                ts.createObjectLiteral(
                    [
                        ...Object.entries(props)
                            .map(e => ts.createPropertyAssignment(e[0],
                                typeof e[1] === 'string' && (
                                  e[1].startsWith('DataType.') || e[1].startsWith('Sequelize.')
                                ) ? ts.createIdentifier(e[1]) : ts.createLiteral(e[1])))
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
        ts.createArrowFunction(
            undefined,
            undefined,
            [],
            undefined,
            ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            ts.createIdentifier(t)
        ),
    );

    objectLiteralProps && argumentsArray.push(
        ts.createObjectLiteral([
            ...Object.entries(objectLiteralProps).map(e =>
                ts.createPropertyAssignment(e[0], ts.createLiteral(e[1]))
            )
        ])
    );

    return ts.createDecorator(
        ts.createCall(
            ts.createIdentifier(decoratorIdentifier),
            undefined,
            argumentsArray
        )
    );
};
