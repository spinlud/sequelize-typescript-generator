import * as ts from 'typescript';
import { AbstractDataTypeConstructor } from 'sequelize';

const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});

/**
 *
 * @param node
 */
export const nodeToString = (node: ts.Node) => {
    const sourceFile = ts.createSourceFile(
        `source.ts`,
        ``,
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.TS
    );

    return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

/**
 * Generate named imports code (e.g. `import { Something, Else } from "module"`)
 * @param importsSpecifier {string[]}
 * @param moduleSpecifier {string}
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
}

/**
 *
 * @param decoratorIdentifier
 * @param props
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
                                typeof e[1] === 'string' && e[1].startsWith('DataType.') ?
                                    ts.createIdentifier(e[1]) : ts.createLiteral(e[1])))
                    ]
                )
            ]
        )
    );
}

/**
 *
 * @param decoratorIdentifier
 * @param arrowTargetIdentifier
 */
const generateSingleArrowDecorator = (decoratorIdentifier: string, arrowTargetIdentifier: string): ts.Decorator => {
    return ts.createDecorator(
        ts.createCall(
            ts.createIdentifier(decoratorIdentifier),
            undefined,
            [
                ts.createArrowFunction(
                    undefined,
                    undefined,
                    [],
                    undefined,
                    ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    ts.createIdentifier(arrowTargetIdentifier)
                )
            ]
        )
    );
}

