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
