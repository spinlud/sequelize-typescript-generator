import * as ts from 'typescript';
import type { ITablesMetadata } from '../dialects/Dialect.js';
import { generateTypeOnlyIndexExport } from './utils.js';
import { JSON_SUPPORT_FILE_BASENAME, tablesHaveJsonColumn } from './jsonSupport.js';
import { ENUM_SUPPORT_FILE_BASENAME, tablesHaveSharedEnumType } from './enumSupport.js';

/**
 * Build the type-only index re-exports of the shared type files emitted next to
 * the models: the `Json` support file when a column uses the `Json` type, then
 * the enum support file when a column uses an enum shared type. A file that is
 * not emitted gets no re-export.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {ts.ExportDeclaration[]}
 */
export const buildSharedTypesIndexExports = (tablesMetadata: ITablesMetadata): ts.ExportDeclaration[] => [
    ...tablesHaveJsonColumn(tablesMetadata) ? [generateTypeOnlyIndexExport(JSON_SUPPORT_FILE_BASENAME)] : [],
    ...tablesHaveSharedEnumType(tablesMetadata) ? [generateTypeOnlyIndexExport(ENUM_SUPPORT_FILE_BASENAME)] : [],
];
