import type { IColumnMetadata } from './Dialect.js';
import type { IConfigMetadata } from '../config/IConfig.js';

/**
 * Database column names recognized as soft-delete markers.
 */
export const PARANOID_COLUMN_NAMES = ['deleted_at', 'deletedat'] as const;

/**
 * Find the soft-delete column of a table, matching the database column name
 * case-insensitively against deleted_at / deletedAt.
 * @param {IColumnMetadata[]} columns
 * @returns {IColumnMetadata | undefined}
 */
export const findParanoidColumn = (columns: IColumnMetadata[]): IColumnMetadata | undefined =>
    columns.find(column =>
        PARANOID_COLUMN_NAMES.some(name => name === column.originName.toLowerCase())
    );

export interface IParanoidResolution {
    enabled: boolean;
    warning?: string;
}

/**
 * Resolve whether paranoid table options should be emitted. Sequelize requires
 * timestamps for paranoid models, so without them the option is ignored with a warning.
 * @param {IConfigMetadata | undefined} metadata
 * @returns {IParanoidResolution}
 */
export const resolveParanoidOption = (metadata: IConfigMetadata | undefined): IParanoidResolution => {
    if (!metadata?.paranoid) {
        return { enabled: false };
    }

    if (!metadata.timestamps) {
        return {
            enabled: false,
            warning: 'The --paranoid option requires --timestamps and will be ignored.',
        };
    }

    return { enabled: true };
};
