import * as ts from 'typescript';
import { ModelAttributeColumnOptions } from 'sequelize';
import { IColumnMetadata, ITableMetadata, Dialect } from '../dialects';
import {
    Generator,
    generateNamedImports,
    generateObjectLiteralDecorator,
    nodeToString,
} from './';

const createColumnPropertyDecl = (col: IColumnMetadata, dataTypeMap: { [key: string]: string }): ts.PropertyDeclaration => {
    const props: Partial<ModelAttributeColumnOptions> = {
        ...col.primaryKey && { primaryKey: col.primaryKey },
        ...col.autoIncrement && { autoIncrement: col.autoIncrement },
        ...col.allowNull && { allowNull: col.allowNull },
        type: col.type,
    };

    return ts.createProperty(
        [
            generateObjectLiteralDecorator('Column', props),
        ],
        undefined,
        col.name,
        (col.autoIncrement || col.allowNull) ?
            ts.createToken(ts.SyntaxKind.QuestionToken) : ts.createToken(ts.SyntaxKind.ExclamationToken),
        ts.createTypeReferenceNode(dataTypeMap[col.type] ?? 'any', undefined),
        undefined
    );
}

/**
 * @class ModelGenerator
 * @constructor
 * @param {Dialect} dialect
 */
export class ModelGenerator extends Generator {
    constructor(dialect: Dialect) {
        super(dialect);
    }

    async generate(tableMetadata: ITableMetadata): Promise<string> {
        const { name: tableName, columns } = tableMetadata;

        const classDecl = ts.createClassDeclaration(
            [
                // @Table decorator
                generateObjectLiteralDecorator('Table', {
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
            columns.map(col => createColumnPropertyDecl(col, this.dialect.jsDataTypesMap))
        );

        let generatedCode = '';

        generatedCode += generateNamedImports(
            [
                'Table',
                'Column',
                'PrimaryKey',
                'DataType'
            ],
            'sequelize-typescript'
        );

        generatedCode += '\n';

        generatedCode += nodeToString(classDecl);

        return generatedCode;
    }
}
