import * as ts from 'typescript';
import type { ITableMetadata, ITablesMetadata } from '../dialects/Dialect.js';
import { generateTypeOnlyImport, nodeToString } from './utils.js';

/**
 * Base name of the shared support file holding the recursive `Json` type. Chosen
 * to be distinct from generated model names; a collision with a model name is
 * reported by `findJsonSupportFileNameCollision`.
 */
export const JSON_SUPPORT_FILE_BASENAME = 'jsonType';

/**
 * File name of the shared JSON support file.
 */
export const JSON_SUPPORT_FILE_NAME = `${JSON_SUPPORT_FILE_BASENAME}.ts`;

/**
 * Exported type name of the recursive JSON union.
 */
export const JSON_TYPE_NAME = 'Json';

/**
 * Sibling module specifier used by model files to import the `Json` type.
 */
export const JSON_SUPPORT_MODULE_SPECIFIER = `./${JSON_SUPPORT_FILE_BASENAME}`;

/**
 * Build the recursive `Json` type alias declaration:
 * `export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };`
 * @returns {ts.TypeAliasDeclaration}
 */
export const buildJsonTypeAliasDeclaration = (): ts.TypeAliasDeclaration => {
    const jsonReference = ts.factory.createTypeReferenceNode(JSON_TYPE_NAME, undefined);

    const indexSignature = ts.factory.createTypeLiteralNode([
        ts.factory.createIndexSignature(
            undefined,
            [ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                'key',
                undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                undefined
            )],
            jsonReference
        ),
    ]);

    const union = ts.factory.createUnionTypeNode([
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
        ts.factory.createLiteralTypeNode(ts.factory.createNull()),
        ts.factory.createArrayTypeNode(jsonReference),
        indexSignature,
    ]);

    return ts.factory.createTypeAliasDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        JSON_TYPE_NAME,
        undefined,
        union
    );
};

/**
 * Render the shared JSON support file source.
 * @returns {string}
 */
export const renderJsonSupportFile = (): string => nodeToString(buildJsonTypeAliasDeclaration());

/**
 * Build the type-only import of the `Json` type from the shared support file.
 * @returns {ts.ImportDeclaration}
 */
export const buildJsonTypeImport = (): ts.ImportDeclaration =>
    generateTypeOnlyImport([JSON_TYPE_NAME], JSON_SUPPORT_MODULE_SPECIFIER);

/**
 * Report whether a table has at least one JSON/JSONB column.
 * @param {ITableMetadata} table
 * @returns {boolean}
 */
export const tableHasJsonColumn = (table: ITableMetadata): boolean =>
    Object.values(table.columns).some(column => column.isJson === true);

/**
 * Report whether any table has at least one JSON/JSONB column.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {boolean}
 */
export const tablesHaveJsonColumn = (tablesMetadata: ITablesMetadata): boolean =>
    Object.values(tablesMetadata).some(tableHasJsonColumn);

/**
 * Find a generated model whose name collides with the shared support file name,
 * returning the model name, or undefined when there is no collision.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {string | undefined}
 */
export const findJsonSupportFileNameCollision = (tablesMetadata: ITablesMetadata): string | undefined =>
    Object.values(tablesMetadata).find(table => table.name === JSON_SUPPORT_FILE_BASENAME)?.name;

/**
 * Warn when a generated model name collides with the shared JSON support file
 * name, which would make both write to the same file.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {void}
 */
export const warnJsonSupportFileNameCollision = (tablesMetadata: ITablesMetadata): void => {
    const collision = findJsonSupportFileNameCollision(tablesMetadata);

    if (collision) {
        console.warn(
            '[WARNING]',
            `Model '${collision}' collides with the shared JSON support file '${JSON_SUPPORT_FILE_NAME}'; ` +
            `the generated model and the '${JSON_TYPE_NAME}' type file would overwrite each other.`
        );
    }
};
