import * as ts from 'typescript';
import { ModelAttributeColumnOptions } from 'sequelize';
import { IColumnMetadata, ITableMetadata } from '../dialects/Dialect';
import { dataTypesJsMap } from '../dialects/DialectMySQL';
import { generateNamedImports } from './importGenerator';

const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});

const createObjectLiteralDecorator = (
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
                            .map(e => ts.createPropertyAssignment(e[0], ts.createLiteral(e[1])))
                    ]
                )
            ]
        )
    );
}

const createSingleArrowDecorator = (decoratorIdentifier: string, arrowTargetIdentifier: string): ts.Decorator => {
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

// ts.createDecorator(
//     ts.createCall(
//         ts.createIdentifier('Table'),
//         undefined,
//         [
//             ts.createObjectLiteral(
//                 [
//                     ts.createPropertyAssignment('tableName', ts.createIdentifier(tableName))
//                 ]
//             )
//         ]
//     )
// )

const createColumnPropertyDecl = (col: IColumnMetadata): ts.PropertyDeclaration => {
    const props: Partial<ModelAttributeColumnOptions> = {
        ...col.primaryKey && { primaryKey: col.primaryKey },
        ...col.autoIncrement && { autoIncrement: col.autoIncrement },
        ...col.allowNull && { allowNull: col.allowNull },
        type: col.type,
    };

    return ts.createProperty(
        [
            createObjectLiteralDecorator('Column', props),
        ],
        undefined,
        col.name,
        (col.autoIncrement || col.allowNull) ?
            ts.createToken(ts.SyntaxKind.QuestionToken) : ts.createToken(ts.SyntaxKind.ExclamationToken),
        ts.createTypeReferenceNode(dataTypesJsMap[col.type], undefined),
        undefined
    );
}

/**
 * Generate model class from table metadata
 * @param tableMetadata {ITableMetadata}
 * @returns {string} Model class code
 */
export const generateModel = (tableMetadata: ITableMetadata): string => {
    const sourceFile = ts.createSourceFile(
        `source.ts`,
        ``,
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.TS
    );

    const { name: tableName, columns } = tableMetadata;

    const classDecl = ts.createClassDeclaration(
        [
            // @Table decorator
            createObjectLiteralDecorator('Table', {
                tableName: tableName,
                timestamps: false,
            })
        ],
        [
            ts.createToken(ts.SyntaxKind.ExportKeyword),
        ],
        tableName,
        undefined,
        [
            ts.createHeritageClause(
                ts.SyntaxKind.ExtendsKeyword,
                [
                    ts.createExpressionWithTypeArguments(
                        [ ts.createTypeReferenceNode(tableName, undefined) ],
                        ts.createIdentifier('Model')
                    )
                ]

            )
        ],
        columns.map(col => createColumnPropertyDecl(col))
    );

    let modelCode = '';

    modelCode += generateNamedImports(
        [
            'Table',
            'Column',
            'PrimaryKey',
            'DataType'
        ],
        'sequelize-typescript'
    );

    modelCode += '\n';

    modelCode += printer.printNode(ts.EmitHint.Unspecified, classDecl, sourceFile);

    return modelCode;
}
