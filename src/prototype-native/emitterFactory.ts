import * as ts from 'typescript';
import { nodeToString, generateNamedImports } from '../builders/utils';
import {
    INativeTableMetadata,
    INativeColumnMetadata,
    INativeAssociationMetadata,
} from './fixture';
import {
    classifyAttribute,
    mapToJsBaseType,
    buildAssociationMixins,
    associationAlias,
    isToManyAssociation,
    buildIndexes,
    collectSequelizeImports,
    collectModelImports,
} from './shared';

// Emits native Sequelize v6 models with the TypeScript compiler API (ts.factory + printer),
// reusing the repo's `nodeToString` and `generateNamedImports` helpers. Structured to mirror
// ModelBuilder.ts so the comparison with the template emitter is fair.

const declareModifier = (): ts.ModifierLike => ts.factory.createToken(ts.SyntaxKind.DeclareKeyword);
const staticModifier = (): ts.ModifierLike => ts.factory.createToken(ts.SyntaxKind.StaticKeyword);

/**
 * Build the TypeScript type node for a column's base JS type.
 */
const buildBaseTypeNode = (col: INativeColumnMetadata): ts.TypeNode => {
    switch (mapToJsBaseType(col)) {
        case 'number':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        case 'string':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
        case 'Date':
            return ts.factory.createTypeReferenceNode('Date', undefined);
        default:
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    }
};

/**
 * Build the attribute type node for a column according to its classification.
 */
const buildAttributeTypeNode = (col: INativeColumnMetadata): ts.TypeNode => {
    const base = buildBaseTypeNode(col);

    switch (classifyAttribute(col)) {
        case 'creationOptional':
            return ts.factory.createTypeReferenceNode('CreationOptional', [base]);
        case 'foreignKey':
            return ts.factory.createTypeReferenceNode('ForeignKey', [
                ts.factory.createIndexedAccessTypeNode(
                    ts.factory.createTypeReferenceNode(col.foreignKey!.targetModel, undefined),
                    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(col.foreignKey!.targetKey))
                ),
            ]);
        case 'nullable':
            return ts.factory.createUnionTypeNode([
                base,
                ts.factory.createLiteralTypeNode(ts.factory.createNull()),
            ]);
        default:
            return base;
    }
};

/**
 * Build a `declare <name>: <type>;` class field for a column attribute.
 */
const buildColumnField = (col: INativeColumnMetadata): ts.PropertyDeclaration => {
    return ts.factory.createPropertyDeclaration(
        [declareModifier()],
        col.name,
        undefined,
        buildAttributeTypeNode(col),
        undefined
    );
};

/**
 * Build the `declare <method>: <MixinType><...>;` fields for an association.
 */
const buildMixinFields = (assoc: INativeAssociationMetadata): ts.PropertyDeclaration[] => {
    return buildAssociationMixins(assoc).map(mixin =>
        ts.factory.createPropertyDeclaration(
            [declareModifier()],
            mixin.methodName,
            undefined,
            ts.factory.createTypeReferenceNode(
                mixin.mixinType,
                mixin.typeArguments.length
                    ? mixin.typeArguments.map(arg => ts.factory.createTypeReferenceNode(arg, undefined))
                    : undefined
            ),
            undefined
        )
    );
};

/**
 * Build the optional included-association field, e.g. `declare books?: NonAttribute<Books[]>;`.
 */
const buildIncludedField = (assoc: INativeAssociationMetadata): ts.PropertyDeclaration => {
    const targetRef = ts.factory.createTypeReferenceNode(assoc.targetModel, undefined);
    const innerType = isToManyAssociation(assoc)
        ? ts.factory.createArrayTypeNode(targetRef)
        : targetRef;

    return ts.factory.createPropertyDeclaration(
        [declareModifier()],
        ts.factory.createIdentifier(associationAlias(assoc)),
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createTypeReferenceNode('NonAttribute', [innerType]),
        undefined
    );
};

/**
 * Build `declare static associations: { alias: Association<Source, Target>; };`.
 */
const buildStaticAssociations = (
    table: INativeTableMetadata,
    associations: INativeAssociationMetadata[]
): ts.PropertyDeclaration => {
    const members = associations.map(assoc =>
        ts.factory.createPropertySignature(
            undefined,
            associationAlias(assoc),
            undefined,
            ts.factory.createTypeReferenceNode('Association', [
                ts.factory.createTypeReferenceNode(table.name, undefined),
                ts.factory.createTypeReferenceNode(assoc.targetModel, undefined),
            ])
        )
    );

    return ts.factory.createPropertyDeclaration(
        [declareModifier(), staticModifier()],
        'associations',
        undefined,
        ts.factory.createTypeLiteralNode(members),
        undefined
    );
};

/**
 * Build one column's options object literal for Model.init.
 */
const buildColumnInitOptions = (col: INativeColumnMetadata): ts.ObjectLiteralExpression => {
    const props: ts.PropertyAssignment[] = [
        ts.factory.createPropertyAssignment('type', ts.factory.createIdentifier(col.dataType!)),
    ];

    if (col.primaryKey) {
        props.push(ts.factory.createPropertyAssignment('primaryKey', ts.factory.createTrue()));
    }
    if (col.autoIncrement) {
        props.push(ts.factory.createPropertyAssignment('autoIncrement', ts.factory.createTrue()));
    }
    if (!col.primaryKey) {
        props.push(ts.factory.createPropertyAssignment(
            'allowNull',
            col.allowNull ? ts.factory.createTrue() : ts.factory.createFalse()
        ));
    }
    if (col.name !== col.originName) {
        props.push(ts.factory.createPropertyAssignment('field', ts.factory.createStringLiteral(col.originName)));
    }
    if (col.foreignKey) {
        props.push(ts.factory.createPropertyAssignment(
            'references',
            ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment('model', ts.factory.createStringLiteral(col.foreignKey.targetTable)),
                ts.factory.createPropertyAssignment('key', ts.factory.createStringLiteral(col.foreignKey.targetKey)),
            ], true)
        ));
    }

    return ts.factory.createObjectLiteralExpression(props, true);
};

/**
 * Build the model options object literal (second argument of Model.init).
 */
const buildModelInitOptions = (table: INativeTableMetadata): ts.ObjectLiteralExpression => {
    const props: ts.ObjectLiteralElementLike[] = [
        ts.factory.createShorthandPropertyAssignment('sequelize'),
        ts.factory.createPropertyAssignment('tableName', ts.factory.createStringLiteral(table.originName)),
        ts.factory.createPropertyAssignment(
            'timestamps',
            table.timestamps ? ts.factory.createTrue() : ts.factory.createFalse()
        ),
    ];

    const indexes = buildIndexes(table);
    if (indexes.length) {
        props.push(ts.factory.createPropertyAssignment(
            'indexes',
            ts.factory.createArrayLiteralExpression(
                indexes.map(index => {
                    const indexProps: ts.PropertyAssignment[] = [
                        ts.factory.createPropertyAssignment('name', ts.factory.createStringLiteral(index.name)),
                    ];
                    if (index.unique) {
                        indexProps.push(ts.factory.createPropertyAssignment('unique', ts.factory.createTrue()));
                    }
                    indexProps.push(ts.factory.createPropertyAssignment(
                        'fields',
                        ts.factory.createArrayLiteralExpression(
                            index.fields.map(f => ts.factory.createStringLiteral(f)),
                            false
                        )
                    ));
                    return ts.factory.createObjectLiteralExpression(indexProps, true);
                }),
                true
            )
        ));
    }

    return ts.factory.createObjectLiteralExpression(props, true);
};

/**
 * Build the `static initModel(sequelize: Sequelize): typeof Model { ... }` method.
 */
const buildInitModelMethod = (table: INativeTableMetadata): ts.MethodDeclaration => {
    const attributes = ts.factory.createObjectLiteralExpression(
        Object.values(table.columns).map(col =>
            ts.factory.createPropertyAssignment(col.name, buildColumnInitOptions(col))
        ),
        true
    );

    const initCall = ts.factory.createExpressionStatement(
        ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(table.name), 'init'),
            undefined,
            [attributes, buildModelInitOptions(table)]
        )
    );

    const returnStatement = ts.factory.createReturnStatement(ts.factory.createIdentifier(table.name));

    return ts.factory.createMethodDeclaration(
        [staticModifier()],
        undefined,
        'initModel',
        undefined,
        undefined,
        [
            ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                'sequelize',
                undefined,
                ts.factory.createTypeReferenceNode('Sequelize', undefined),
                undefined
            ),
        ],
        ts.factory.createTypeQueryNode(ts.factory.createIdentifier(table.name)),
        ts.factory.createBlock([initCall, returnStatement], true)
    );
};

/**
 * Build the exported model class declaration.
 */
const buildModelClass = (table: INativeTableMetadata): ts.ClassDeclaration => {
    const associations = table.associations ?? [];

    const members: ts.ClassElement[] = [
        ...Object.values(table.columns).map(buildColumnField),
    ];

    for (const assoc of associations) {
        members.push(...buildMixinFields(assoc));
    }
    for (const assoc of associations) {
        members.push(buildIncludedField(assoc));
    }
    if (associations.length) {
        members.push(buildStaticAssociations(table, associations));
    }

    members.push(buildInitModelMethod(table));

    return ts.factory.createClassDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        table.name,
        undefined,
        [
            ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
                ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier('Model'), [
                    ts.factory.createTypeReferenceNode('InferAttributes', [
                        ts.factory.createTypeReferenceNode(table.name, undefined),
                    ]),
                    ts.factory.createTypeReferenceNode('InferCreationAttributes', [
                        ts.factory.createTypeReferenceNode(table.name, undefined),
                    ]),
                ]),
            ]),
        ],
        members
    );
};

/**
 * Emit the source text for a single model file.
 */
export const emitModelFile = (table: INativeTableMetadata): string => {
    let code = nodeToString(generateNamedImports(collectSequelizeImports(table), 'sequelize'));
    code += '\n';

    for (const modelName of collectModelImports(table)) {
        code += nodeToString(generateNamedImports([modelName], `./${modelName}`));
        code += '\n';
    }

    code += '\n';
    code += nodeToString(buildModelClass(table));
    code += '\n';

    return code;
};

/**
 * Emit the wiring file: inits every model, wires associations, returns them.
 */
export const emitInitModelsFile = (tables: INativeTableMetadata[]): string => {
    let code = nodeToString(generateNamedImports(['Sequelize'], 'sequelize'));
    code += '\n';

    for (const table of tables) {
        code += nodeToString(generateNamedImports([table.name], `./${table.name}`));
        code += '\n';
    }

    // Statements inside the initModels function body.
    const statements: ts.Statement[] = [];

    for (const table of tables) {
        statements.push(ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(table.name), 'initModel'),
                undefined,
                [ts.factory.createIdentifier('sequelize')]
            )
        ));
    }

    for (const table of tables) {
        for (const assoc of table.associations ?? []) {
            const options: ts.PropertyAssignment[] = [];
            if (assoc.associationName === 'BelongsTo') {
                options.push(ts.factory.createPropertyAssignment('targetKey', ts.factory.createStringLiteral(assoc.targetKey!)));
            }
            else if (assoc.sourceKey) {
                options.push(ts.factory.createPropertyAssignment('sourceKey', ts.factory.createStringLiteral(assoc.sourceKey)));
            }
            options.push(ts.factory.createPropertyAssignment('foreignKey', ts.factory.createStringLiteral(assoc.foreignKey)));
            options.push(ts.factory.createPropertyAssignment('as', ts.factory.createStringLiteral(associationAlias(assoc))));

            const methodName = assoc.associationName.charAt(0).toLowerCase() + assoc.associationName.slice(1);

            statements.push(ts.factory.createExpressionStatement(
                ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(table.name), methodName),
                    undefined,
                    [
                        ts.factory.createIdentifier(assoc.targetModel),
                        ts.factory.createObjectLiteralExpression(options, true),
                    ]
                )
            ));
        }
    }

    statements.push(ts.factory.createReturnStatement(
        ts.factory.createObjectLiteralExpression(
            tables.map(t => ts.factory.createShorthandPropertyAssignment(t.name)),
            true
        )
    ));

    const initModels = ts.factory.createFunctionDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        undefined,
        'initModels',
        undefined,
        [
            ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                'sequelize',
                undefined,
                ts.factory.createTypeReferenceNode('Sequelize', undefined),
                undefined
            ),
        ],
        undefined,
        ts.factory.createBlock(statements, true)
    );

    code += '\n';
    code += nodeToString(initModels);
    code += '\n';

    return code;
};
