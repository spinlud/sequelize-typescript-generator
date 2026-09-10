import * as ts from 'typescript';
import type { Dialect } from '../dialects/Dialect.js';
import type { IColumnMetadata, ITableMetadata } from '../dialects/Dialect.js';
import type { IAssociationMetadata } from '../dialects/AssociationsParser.js';
import { DATA_TYPE_NAMESPACES } from '../dialects/dataTypes.js';
import {
    buildDataTypeExpression,
    buildObjectLiteralExpression,
    createGenericTypeReference,
    createIndexedAccessTypeNode,
    createTypeNodeFromName,
    generateNamedImports,
    generateTypeOnlyImport,
    nodeToString,
    PropertyValue,
} from './utils.js';
import { buildDefaultValueExpression, parseDefaultValue } from './defaultValues.js';
import {
    classifyAttribute,
    collectTableIndexes,
    COLUMN_OPTION_KEYS,
    INativeIndex,
    isParanoidColumn,
    resolveForeignKeyTargetAttribute,
    resolvePrimaryKeyAttribute,
    TIMESTAMP_ATTRIBUTES,
} from './nativeAttributes.js';
import {
    buildAssociationMixinDeclarations,
    collectModelTypeImports,
    collectSequelizeImports,
    IMixinDeclaration,
    isToManyAssociation,
    MixinTypeArgument,
    resolveAssociationForeignKey,
} from './nativeAssociations.js';
import { resolveAssociationPropertyName } from './ModelBuilder.js';

const NATIVE_NAMESPACE = DATA_TYPE_NAMESPACES.native;

/**
 * Union a type node with the null literal type, flattening an existing union so
 * that a string-literal union renders as `"AA" | "BB" | null` rather than nesting.
 * @param {ts.TypeNode} type
 * @returns {ts.TypeNode}
 */
const buildNullableTypeNode = (type: ts.TypeNode): ts.TypeNode => {
    const nullType = ts.factory.createLiteralTypeNode(ts.factory.createNull());
    const members = ts.isUnionTypeNode(type) ? [...type.types, nullType] : [type, nullType];

    return ts.factory.createUnionTypeNode(members);
};

/**
 * Build a `declare` field declaration, optionally static and optionally optional.
 * @param {string} name
 * @param {ts.TypeNode} type
 * @param {{ isStatic?: boolean; isOptional?: boolean }} options
 * @returns {ts.PropertyDeclaration}
 */
const buildDeclareField = (
    name: string,
    type: ts.TypeNode,
    options: { isStatic?: boolean; isOptional?: boolean } = {}
): ts.PropertyDeclaration => {
    const modifiers: ts.ModifierLike[] = [ts.factory.createToken(ts.SyntaxKind.DeclareKeyword)];

    if (options.isStatic) {
        modifiers.push(ts.factory.createToken(ts.SyntaxKind.StaticKeyword));
    }

    return ts.factory.createPropertyDeclaration(
        modifiers,
        name,
        options.isOptional ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
        type,
        undefined
    );
};

/**
 * Build the base TypeScript type node of a column, before nullability and brand
 * wrapping. Paranoid soft-delete columns are always `Date`; enum columns become a
 * string-literal union; everything else maps through the dialect JS mapping.
 * @param {IColumnMetadata} column
 * @param {ITableMetadata} table
 * @param {Dialect} dialect
 * @returns {ts.TypeNode}
 */
const buildBaseTypeNode = (column: IColumnMetadata, table: ITableMetadata, dialect: Dialect): ts.TypeNode => {
    if (isParanoidColumn(column, table)) {
        return createTypeNodeFromName('Date');
    }

    const { sequelizeType } = column;

    if (sequelizeType && sequelizeType.key === 'ENUM' && sequelizeType.args.length > 0) {
        return ts.factory.createUnionTypeNode(
            sequelizeType.args.map(arg =>
                ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(String(arg)))
            )
        );
    }

    return createTypeNodeFromName(dialect.mapDbTypeToJs(column.type));
};

/**
 * Build the declared type node of a column attribute. Foreign keys to generated
 * models are branded with `ForeignKey<Target["key"]>`; other columns are wrapped
 * with `CreationOptional` and `| null` according to their attribute kind.
 * @param {IColumnMetadata} column
 * @param {ITableMetadata} table
 * @param {Dialect} dialect
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {ts.TypeNode}
 */
export const buildAttributeTypeNode = (
    column: IColumnMetadata,
    table: ITableMetadata,
    dialect: Dialect,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): ts.TypeNode => {
    const targetModel = column.foreignKey?.targetModel;
    const isForeignKeyTargetGenerated = targetModel !== undefined && tablesByModel.has(targetModel);
    const kind = classifyAttribute(column, table, isForeignKeyTargetGenerated);

    if (column.foreignKey && (kind === 'foreignKey' || kind === 'foreignKeyNullable')) {
        const target = tablesByModel.get(column.foreignKey.targetModel);
        const targetAttribute = target
            ? resolveForeignKeyTargetAttribute(column.foreignKey, target)
            : undefined;
        const referenced = targetAttribute
            ? createIndexedAccessTypeNode(column.foreignKey.targetModel, targetAttribute)
            : ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        const inner = kind === 'foreignKeyNullable' ? buildNullableTypeNode(referenced) : referenced;

        return createGenericTypeReference('ForeignKey', [inner]);
    }

    const base = buildBaseTypeNode(column, table, dialect);

    switch (kind) {
        case 'nullable':
            return buildNullableTypeNode(base);
        case 'creationOptional':
            return createGenericTypeReference('CreationOptional', [base]);
        case 'creationOptionalNullable':
            return createGenericTypeReference('CreationOptional', [buildNullableTypeNode(base)]);
        default:
            return base;
    }
};

/**
 * Build the `declare` attribute member of a column.
 * @param {IColumnMetadata} column
 * @param {ITableMetadata} table
 * @param {Dialect} dialect
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {ts.PropertyDeclaration}
 */
export const buildAttributeDeclaration = (
    column: IColumnMetadata,
    table: ITableMetadata,
    dialect: Dialect,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): ts.PropertyDeclaration =>
    buildDeclareField(column.name, buildAttributeTypeNode(column, table, dialect, tablesByModel));

/**
 * Build the `declare createdAt`/`declare updatedAt` members of a model, emitted
 * only when timestamps are enabled.
 * @param {ITableMetadata} table
 * @returns {ts.PropertyDeclaration[]}
 */
export const buildTimestampDeclarations = (table: ITableMetadata): ts.PropertyDeclaration[] => {
    if (!table.timestamps) {
        return [];
    }

    return TIMESTAMP_ATTRIBUTES.map(attribute =>
        buildDeclareField(
            attribute,
            createGenericTypeReference('CreationOptional', [createTypeNodeFromName('Date')])
        )
    );
};

/**
 * Turn a mixin type argument descriptor into a type node.
 * @param {MixinTypeArgument} argument
 * @returns {ts.TypeNode}
 */
const buildMixinTypeArgument = (argument: MixinTypeArgument): ts.TypeNode => {
    switch (argument.kind) {
        case 'model':
            return createGenericTypeReference(argument.name, []);
        case 'attribute':
            return createIndexedAccessTypeNode(argument.model, argument.attribute);
        case 'literal':
            return ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(argument.value));
        case 'number':
            return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    }
};

/**
 * Build the `declare` member of an association mixin.
 * @param {IMixinDeclaration} mixin
 * @returns {ts.PropertyDeclaration}
 */
export const buildMixinDeclaration = (mixin: IMixinDeclaration): ts.PropertyDeclaration =>
    buildDeclareField(
        mixin.propertyName,
        createGenericTypeReference(mixin.mixinTypeName, mixin.typeArguments.map(buildMixinTypeArgument))
    );

/**
 * Build the optional `NonAttribute` member exposing the associated model(s).
 * @param {IAssociationMetadata} association
 * @returns {ts.PropertyDeclaration}
 */
export const buildIncludedAssociationDeclaration = (association: IAssociationMetadata): ts.PropertyDeclaration => {
    const alias = resolveAssociationPropertyName(association);
    const targetReference = createGenericTypeReference(association.targetModel, []);
    const included = isToManyAssociation(association)
        ? ts.factory.createArrayTypeNode(targetReference)
        : targetReference;

    return buildDeclareField(alias, createGenericTypeReference('NonAttribute', [included]), { isOptional: true });
};

/**
 * Build the `declare static associations` member, or undefined when the model has
 * no associations.
 * @param {ITableMetadata} table
 * @returns {ts.PropertyDeclaration | undefined}
 */
export const buildStaticAssociationsDeclaration = (table: ITableMetadata): ts.PropertyDeclaration | undefined => {
    const associations = table.associations ?? [];

    if (associations.length === 0) {
        return undefined;
    }

    const members = associations.map(association =>
        ts.factory.createPropertySignature(
            undefined,
            resolveAssociationPropertyName(association),
            undefined,
            createGenericTypeReference('Association', [
                createGenericTypeReference(table.name, []),
                createGenericTypeReference(association.targetModel, []),
            ])
        )
    );

    return buildDeclareField('associations', ts.factory.createTypeLiteralNode(members), { isStatic: true });
};

/**
 * Build the ordered column option record for a column's init entry.
 * @param {IColumnMetadata} column
 * @param {ITableMetadata} table
 * @param {Dialect} dialect
 * @returns {ts.ObjectLiteralExpression}
 */
export const buildColumnInitOptions = (
    column: IColumnMetadata,
    table: ITableMetadata,
    dialect: Dialect
): ts.ObjectLiteralExpression => {
    const options: { [key: string]: PropertyValue } = {};

    for (const key of COLUMN_OPTION_KEYS) {
        switch (key) {
            case 'type':
                if (column.sequelizeType) {
                    options.type = buildDataTypeExpression(column.sequelizeType, NATIVE_NAMESPACE);
                }
                break;
            case 'primaryKey':
                if (column.primaryKey) {
                    options.primaryKey = true;
                }
                break;
            case 'autoIncrement':
                if (column.autoIncrement) {
                    options.autoIncrement = true;
                }
                break;
            case 'allowNull':
                if (!column.primaryKey) {
                    options.allowNull = column.allowNull;
                }
                break;
            case 'defaultValue': {
                if (column.defaultValue === undefined) {
                    break;
                }

                const raw: unknown = column.defaultValue;
                const spelled = typeof raw === 'string' ? dialect.mapDefaultValueToSequelize(raw) : raw;
                const descriptor = parseDefaultValue(spelled);

                if (descriptor) {
                    options.defaultValue = buildDefaultValueExpression(descriptor, NATIVE_NAMESPACE);
                }

                break;
            }
            case 'comment':
                if (column.comment) {
                    options.comment = column.comment;
                }
                break;
            case 'field':
                if (column.originName && column.name !== column.originName) {
                    options.field = column.originName;
                }
                break;
        }
    }

    return buildObjectLiteralExpression(options, true);
};

/**
 * Build the object literal for a single native index.
 * @param {INativeIndex} index
 * @returns {ts.ObjectLiteralExpression}
 */
export const buildIndexLiteral = (index: INativeIndex): ts.ObjectLiteralExpression =>
    buildObjectLiteralExpression({
        name: index.name,
        unique: index.isUnique,
        fields: index.fields,
        ...index.using && { using: index.using },
    }, true);

/**
 * Build the model init options object literal in the fixed key order.
 * @param {ITableMetadata} table
 * @returns {ts.ObjectLiteralExpression}
 */
export const buildModelInitOptions = (table: ITableMetadata): ts.ObjectLiteralExpression => {
    const elements: ts.ObjectLiteralElementLike[] = [
        ts.factory.createShorthandPropertyAssignment('sequelize'),
        ts.factory.createPropertyAssignment('tableName', ts.factory.createStringLiteral(table.originName)),
        ts.factory.createPropertyAssignment('freezeTableName', ts.factory.createTrue()),
    ];

    if (table.schema) {
        elements.push(ts.factory.createPropertyAssignment('schema', ts.factory.createStringLiteral(table.schema)));
    }

    elements.push(ts.factory.createPropertyAssignment(
        'timestamps',
        table.timestamps ? ts.factory.createTrue() : ts.factory.createFalse()
    ));

    if (table.paranoid) {
        elements.push(ts.factory.createPropertyAssignment('paranoid', ts.factory.createTrue()));

        if (table.deletedAt) {
            elements.push(ts.factory.createPropertyAssignment('deletedAt', ts.factory.createStringLiteral(table.deletedAt)));
        }
    }

    if (table.hasTrigger) {
        elements.push(ts.factory.createPropertyAssignment('hasTrigger', ts.factory.createTrue()));
    }

    if (table.comment) {
        elements.push(ts.factory.createPropertyAssignment('comment', ts.factory.createStringLiteral(table.comment)));
    }

    const indexes = collectTableIndexes(table);

    if (indexes.length > 0) {
        elements.push(ts.factory.createPropertyAssignment(
            'indexes',
            ts.factory.createArrayLiteralExpression(indexes.map(buildIndexLiteral), true)
        ));
    }

    return ts.factory.createObjectLiteralExpression(elements, true);
};

/**
 * Build the attributes object literal passed to `Model.init`: one entry per
 * column followed by the Sequelize timestamp attributes when enabled.
 * @param {ITableMetadata} table
 * @param {Dialect} dialect
 * @returns {ts.ObjectLiteralExpression}
 */
const buildInitAttributes = (table: ITableMetadata, dialect: Dialect): ts.ObjectLiteralExpression => {
    const elements: ts.ObjectLiteralElementLike[] = Object.values(table.columns).map(column =>
        ts.factory.createPropertyAssignment(column.name, buildColumnInitOptions(column, table, dialect))
    );

    if (table.timestamps) {
        for (const attribute of TIMESTAMP_ATTRIBUTES) {
            elements.push(ts.factory.createPropertyAssignment(
                attribute,
                ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(NATIVE_NAMESPACE),
                    ts.factory.createIdentifier('DATE')
                )
            ));
        }
    }

    return ts.factory.createObjectLiteralExpression(elements, true);
};

/**
 * Build the `static initModel(sequelize)` method that calls `Model.init` and
 * returns the model class.
 * @param {ITableMetadata} table
 * @param {Dialect} dialect
 * @returns {ts.MethodDeclaration}
 */
export const buildInitModelMethod = (table: ITableMetadata, dialect: Dialect): ts.MethodDeclaration => {
    const initCall = ts.factory.createExpressionStatement(
        ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(table.name),
                ts.factory.createIdentifier('init')
            ),
            undefined,
            [buildInitAttributes(table, dialect), buildModelInitOptions(table)]
        )
    );

    return ts.factory.createMethodDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.StaticKeyword)],
        undefined,
        'initModel',
        undefined,
        undefined,
        [ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            'sequelize',
            undefined,
            createGenericTypeReference('Sequelize', []),
            undefined
        )],
        ts.factory.createTypeQueryNode(ts.factory.createIdentifier(table.name)),
        ts.factory.createBlock(
            [initCall, ts.factory.createReturnStatement(ts.factory.createIdentifier(table.name))],
            true
        )
    );
};

/**
 * Build the association mixin members a model contributes for one association.
 * @param {IAssociationMetadata} association
 * @param {ITableMetadata} table
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {ts.PropertyDeclaration[]}
 */
const buildAssociationMixinMembers = (
    association: IAssociationMetadata,
    table: ITableMetadata,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): ts.PropertyDeclaration[] => {
    const alias = resolveAssociationPropertyName(association);
    const target = tablesByModel.get(association.targetModel);
    const targetPrimaryKeyAttribute = target ? resolvePrimaryKeyAttribute(target) : undefined;
    const foreignKeyAttribute = resolveAssociationForeignKey(table, association, tablesByModel);

    return buildAssociationMixinDeclarations(association, alias, targetPrimaryKeyAttribute, foreignKeyAttribute)
        .map(buildMixinDeclaration);
};

/**
 * Build the model class declaration with its attribute, timestamp, mixin,
 * included-association and static-association members and the init method.
 * @param {ITableMetadata} table
 * @param {Dialect} dialect
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {ts.ClassDeclaration}
 */
export const buildModelClassDeclaration = (
    table: ITableMetadata,
    dialect: Dialect,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): ts.ClassDeclaration => {
    const associations = table.associations ?? [];

    const members: ts.ClassElement[] = [
        ...Object.values(table.columns).map(column =>
            buildAttributeDeclaration(column, table, dialect, tablesByModel)),
        ...buildTimestampDeclarations(table),
        ...associations.flatMap(association =>
            buildAssociationMixinMembers(association, table, tablesByModel)),
        ...associations.map(buildIncludedAssociationDeclaration),
    ];

    const staticAssociations = buildStaticAssociationsDeclaration(table);

    if (staticAssociations) {
        members.push(staticAssociations);
    }

    members.push(buildInitModelMethod(table, dialect));

    return ts.factory.createClassDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        table.name,
        undefined,
        [ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
            ts.factory.createExpressionWithTypeArguments(
                ts.factory.createIdentifier('Model'),
                [
                    createGenericTypeReference('InferAttributes', [createGenericTypeReference(table.name, [])]),
                    createGenericTypeReference('InferCreationAttributes', [createGenericTypeReference(table.name, [])]),
                ]
            ),
        ])],
        members
    );
};

/**
 * Render one native model source file: the `sequelize` named import, the
 * cross-model `import type` declarations and the model class.
 * @param {ITableMetadata} table
 * @param {Dialect} dialect
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {string}
 */
export const renderNativeModelFile = (
    table: ITableMetadata,
    dialect: Dialect,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): string => {
    let code = nodeToString(generateNamedImports(collectSequelizeImports(table, tablesByModel), 'sequelize'));
    code += '\n';

    for (const modelName of collectModelTypeImports(table, tablesByModel)) {
        code += nodeToString(generateTypeOnlyImport([modelName], `./${modelName}`));
        code += '\n';
    }

    code += '\n';
    code += nodeToString(buildModelClassDeclaration(table, dialect, tablesByModel));

    return code;
};
