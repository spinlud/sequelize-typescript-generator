import { promises as fs } from 'fs';
import path from 'path';
import type { Dialect, ITablesMetadata } from '../dialects/Dialect.js';
import { indexTablesByModelName } from './nativeAttributes.js';
import { renderNativeModelFile } from './NativeModelRenderer.js';
import { renderInitModelsFile, renderNativeIndexFile } from './nativeWiring.js';
import {
    JSON_SUPPORT_FILE_NAME,
    renderJsonSupportFile,
    tablesHaveJsonColumn,
    warnJsonSupportFileNameCollision,
} from './jsonSupport.js';

/**
 * A rendered source file to write to the output directory.
 */
export interface IGeneratedFile {
    fileName: string;
    content: string;
}

/**
 * Render the complete set of native output files: one model file per table, the
 * `initModels.ts` wiring file and the `index.ts` barrel, in table order.
 * @param {ITablesMetadata} tablesMetadata
 * @param {Dialect} dialect
 * @returns {IGeneratedFile[]}
 */
export const renderNativeFiles = (tablesMetadata: ITablesMetadata, dialect: Dialect): IGeneratedFile[] => {
    const tablesByModel = indexTablesByModelName(tablesMetadata);

    const files: IGeneratedFile[] = Object.values(tablesMetadata).map(table => ({
        fileName: `${table.name}.ts`,
        content: renderNativeModelFile(table, dialect, tablesByModel),
    }));

    if (tablesHaveJsonColumn(tablesMetadata)) {
        warnJsonSupportFileNameCollision(tablesMetadata);
        files.push({ fileName: JSON_SUPPORT_FILE_NAME, content: renderJsonSupportFile() });
    }

    files.push({ fileName: 'initModels.ts', content: renderInitModelsFile(tablesMetadata, tablesByModel) });
    files.push({ fileName: 'index.ts', content: renderNativeIndexFile(tablesMetadata) });

    return files;
};

/**
 * Write the rendered files to the output directory, one file per descriptor.
 * @param {string} outDir
 * @param {IGeneratedFile[]} files
 * @returns {Promise<void>}
 */
export const writeGeneratedFiles = async (outDir: string, files: IGeneratedFile[]): Promise<void> => {
    await Promise.all(files.map(file =>
        fs.writeFile(path.join(outDir, file.fileName), file.content, { flag: 'w', encoding: 'utf-8' })
    ));
};
