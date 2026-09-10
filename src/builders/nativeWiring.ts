import * as ts from 'typescript';
import type { ITableMetadata, ITablesMetadata } from '../dialects/Dialect.js';
import {
    createGenericTypeReference,
    generateIndexExport,
    generateNamedImports,
    nodeToString,
} from './utils.js';
import {
    AssociationWiringOptions,
    INativeAssociationWiring,
    resolveAssociationWiring,
} from './nativeAssociations.js';

/**
 * Build the `<model>.initModel(sequelize);` statement wiring a model into the
 * shared connection.
 * @param {string} modelName
 * @returns {ts.ExpressionStatement}
 */
export const buildInitModelCall = (modelName: string): ts.ExpressionStatement =>
    ts.factory.createExpressionStatement(
        ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(modelName),
                ts.factory.createIdentifier('initModel')
            ),
            undefined,
            [ts.factory.createIdentifier('sequelize')]
        )
    );

/**
 * Build the ordered option properties of an association call: as, through,
 * foreignKey, otherKey, targetKey, sourceKey, onDelete, onUpdate. `through`
 * references the junction model as a value identifier; every other option is a
 * string literal.
 * @param {AssociationWiringOptions} options
 * @returns {ts.ObjectLiteralElementLike[]}
 */
const buildAssociationOptions = (options: AssociationWiringOptions): ts.ObjectLiteralElementLike[] => {
    const properties: ts.ObjectLiteralElementLike[] = [];

    const pushString = (key: string, value: unknown): void => {
        if (typeof value === 'string') {
            properties.push(ts.factory.createPropertyAssignment(key, ts.factory.createStringLiteral(value)));
        }
    };

    pushString('as', options.as);

    if (options.throughModel !== undefined) {
        properties.push(ts.factory.createPropertyAssignment(
            'through',
            ts.factory.createIdentifier(options.throughModel)
        ));
    }

    pushString('foreignKey', options.foreignKey);
    pushString('otherKey', options.otherKey);
    pushString('targetKey', options.targetKey);
    pushString('sourceKey', options.sourceKey);
    pushString('onDelete', options.onDelete);
    pushString('onUpdate', options.onUpdate);

    return properties;
};

/**
 * Build the `<source>.<method>(<target>, { ...options })` association statement.
 * @param {INativeAssociationWiring} wiring
 * @returns {ts.ExpressionStatement}
 */
export const buildAssociationCall = (wiring: INativeAssociationWiring): ts.ExpressionStatement =>
    ts.factory.createExpressionStatement(
        ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(wiring.sourceModel),
                ts.factory.createIdentifier(wiring.method)
            ),
            undefined,
            [
                ts.factory.createIdentifier(wiring.targetModel),
                ts.factory.createObjectLiteralExpression(buildAssociationOptions(wiring.options), true),
            ]
        )
    );

/**
 * Build the `return { ...models };` statement of `initModels`.
 * @param {string[]} modelNames
 * @returns {ts.ReturnStatement}
 */
export const buildModelsReturn = (modelNames: string[]): ts.ReturnStatement =>
    ts.factory.createReturnStatement(
        ts.factory.createObjectLiteralExpression(
            modelNames.map(name => ts.factory.createShorthandPropertyAssignment(name)),
            true
        )
    );

/**
 * Build the exported `initModels(sequelize)` function: every model's `initModel`
 * call, then every association call in table then association order, then the
 * object of models. The function has no explicit return type so the `Models`
 * alias can infer it.
 * @param {ITablesMetadata} tablesMetadata
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {ts.FunctionDeclaration}
 */
export const buildInitModelsFunction = (
    tablesMetadata: ITablesMetadata,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): ts.FunctionDeclaration => {
    const tables = Object.values(tablesMetadata);
    const statements: ts.Statement[] = tables.map(table => buildInitModelCall(table.name));

    for (const table of tables) {
        for (const association of table.associations ?? []) {
            statements.push(buildAssociationCall(resolveAssociationWiring(table, association, tablesByModel)));
        }
    }

    statements.push(buildModelsReturn(tables.map(table => table.name)));

    return ts.factory.createFunctionDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        undefined,
        'initModels',
        undefined,
        [ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            'sequelize',
            undefined,
            createGenericTypeReference('Sequelize', []),
            undefined
        )],
        undefined,
        ts.factory.createBlock(statements, true)
    );
};

/**
 * Build the `export type Models = ReturnType<typeof initModels>;` declaration.
 * @returns {ts.TypeAliasDeclaration}
 */
export const buildModelsTypeAlias = (): ts.TypeAliasDeclaration =>
    ts.factory.createTypeAliasDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        'Models',
        undefined,
        ts.factory.createTypeReferenceNode('ReturnType', [
            ts.factory.createTypeQueryNode(ts.factory.createIdentifier('initModels')),
        ])
    );

/**
 * Render the `initModels.ts` wiring file: the `sequelize` value import, one value
 * import per model, the `initModels` function and the `Models` type alias.
 * @param {ITablesMetadata} tablesMetadata
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {string}
 */
export const renderInitModelsFile = (
    tablesMetadata: ITablesMetadata,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): string => {
    let code = nodeToString(generateNamedImports(['Sequelize'], 'sequelize'));
    code += '\n';

    for (const table of Object.values(tablesMetadata)) {
        code += nodeToString(generateNamedImports([table.name], `./${table.name}`));
        code += '\n';
    }

    code += '\n';
    code += nodeToString(buildInitModelsFunction(tablesMetadata, tablesByModel));
    code += '\n\n';
    code += nodeToString(buildModelsTypeAlias());

    return code;
};

/**
 * Render the `index.ts` barrel re-exporting every model file and the wiring file.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {string}
 */
export const renderNativeIndexFile = (tablesMetadata: ITablesMetadata): string => {
    const exportNames = [...Object.values(tablesMetadata).map(table => table.name), 'initModels'];

    return exportNames.map(name => nodeToString(generateIndexExport(name))).join('\n');
};
