import { IndexType, IndexMethod } from 'sequelize';

export interface IColumnMetadataMySQL {
    TABLE_CATALOG: string;
    TABLE_SCHEMA: string;
    TABLE_NAME: string;
    COLUMN_NAME: string;
    ORDINAL_POSITION?: number;
    COLUMN_DEFAULT?: string;
    IS_NULLABLE: string;
    DATA_TYPE: string;
    CHARACTER_MAXIMUM_LENGTH?: string;
    CHARACTER_OCTET_LENGTH?: string;
    NUMERIC_PRECISION?: number;
    NUMERIC_SCALE?: number;
    DATETIME_PRECISION?: string;
    CHARACTER_SET_NAME?: string;
    COLLATION_NAME?: string;
    COLUMN_TYPE: string;
    COLUMN_KEY: string;
    EXTRA: string;
    PRIVILEGES: string;
    COLUMN_COMMENT: string;
    GENERATION_EXPRESSION: string;

    // Index info
    INDEX_NAME: string | null; // The name of the index. If the index is the primary key, the name is always PRIMARY.
    NON_UNIQUE: number | null; // 0 if the index cannot contain duplicates, 1 if it can
    INDEX_SCHEMA: string | null; // The name of the schema (database) to which the index belongs.
    SEQ_IN_INDEX: number | null; // The column sequence number in the index, starting with 1.
    COLLATION: string | null; // How the column is sorted in the index. This can have values A (ascending), D (descending), or NULL (not sorted).
    CARDINALITY: number | null; // An estimate of the number of unique values in the index.
    SUB_PART: string | null; // The index prefix. That is, the number of indexed characters if the column is only partly indexed, NULL if the entire column is indexed.
    PACKED: string | null;// Indicates how the key is packed. NULL if it is not.
    NULLABLE: string | null; // Contains YES if the column may contain NULL values and '' if not.
    INDEX_TYPE: IndexMethod | null; // The index method used (BTREE, FULLTEXT, HASH, RTREE).
    COMMENT: string | null;
    INDEX_COMMENT: string | null;
}

/**
 * Compute precision/scale signature for numeric types: FLOAT(4, 2), DECIMAL(5, 2) etc
 * @param {IColumnMetadataMySQL} columnMetadataMySQL
 * @returns {string} '(5, 2)'
 */
export const numericPrecisionScale = (columnMetadataMySQL: IColumnMetadataMySQL): string => {
    let res = `(${columnMetadataMySQL.NUMERIC_PRECISION}`;
    res +=  columnMetadataMySQL.NUMERIC_SCALE ?
        `, ${columnMetadataMySQL.NUMERIC_SCALE})` : `)`;
    return res;
};

/**
 * Compute date time precision signature: TIMESTAMP(3), DATETIME(6)
 * @param {IColumnMetadataMySQL} columnMetadataMySQL
 * @returns {string} '(3)'
 */
export const dateTimePrecision = (columnMetadataMySQL: IColumnMetadataMySQL): string => {
    if (columnMetadataMySQL.DATETIME_PRECISION) {
        return `(${columnMetadataMySQL.DATETIME_PRECISION})`;
    }
    else {
        return '';
    }
};
