import * as ts from 'typescript';

const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});

/**
 * Generate named imports code (e.g. `import { Something, Else } from "module"`)
 * @param importsSpecifier {string[]}
 * @param moduleSpecifier {string}
 * @returns {string} Named import code
 */
export const generateNamedImports = (importsSpecifier: string[], moduleSpecifier: string): string => {
    const sourceFile = ts.createSourceFile(
        `source.ts`,
        ``,
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.TS
    );

    const importDeclaration = ts.createImportDeclaration(
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

    return printer.printNode(ts.EmitHint.Unspecified, importDeclaration, sourceFile);
}
