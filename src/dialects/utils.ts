import { IndexType, IndexMethod } from 'sequelize';
import { Case } from '../config/IConfig';
import { ITableMetadata } from './Dialect';
import {
    camelCase,
    constantCase,
    pascalCase,
    snakeCase,
} from "change-case";

export interface ITableNameRow {
    table_name?: string;
    TABLE_NAME?: string;
}

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
    TABLE_COMMENT: string;
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

export interface IColumnMetadataPostgres {
    table_catalog: string;
    table_schema: string;
    table_name: string;
    column_name: string;
    // column_key: string;
    ordinal_position: number;
    column_default: string;
    is_nullable: string;
    data_type: string;
    character_maximum_length: number;
    character_octet_length: number;
    numeric_precision: number;
    numeric_precision_radix: number;
    numeric_scale: number;
    datetime_precision: number;
    interval_type: string;
    interval_precision: number;
    character_set_catalog: string;
    character_set_schema: string;
    character_set_name: string;
    collation_catalog: string;
    collation_schema: string;
    collation_name: string;
    domain_catalog: string;
    domain_schema: string;
    domain_name: string;
    udt_catalog: string;
    udt_schema: string;
    udt_name: string;
    scope_catalog: string;
    scope_schema: string;
    scope_name: string;
    maximum_cardinality: number;
    dtd_identifier: string;
    is_self_referencing: string;
    is_identity: string;
    identity_generation: string;
    identity_start: string;
    identity_increment: string;
    identity_maximum: string;
    identity_minimum: string;
    identity_cycle: string;
    is_generated: string;
    generation_expression: string;
    is_updatable: string;
    is_sequence: boolean;
    index_name: string | null;
    index_type: string | null;
    index_is_primary: string | null;
    index_is_unique: string | null;
    index_is_clustered: string | null;
}

/**
 * Compute precision/scale signature for numeric types: FLOAT(4, 2), DECIMAL(5, 2) etc
 * @param {IColumnMetadataMySQL} columnMetadataMySQL
 * @returns {string} '(5, 2)'
 */
export const numericPrecisionScaleMySQL = (columnMetadataMySQL: IColumnMetadataMySQL): string => {
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
export const dateTimePrecisionMySQL = (columnMetadataMySQL: IColumnMetadataMySQL): string => {
    if (columnMetadataMySQL.DATETIME_PRECISION) {
        return `(${columnMetadataMySQL.DATETIME_PRECISION})`;
    }
    else {
        return '';
    }
};

/**
 * Compute precision/scale signature for numeric types: FLOAT(4, 2), DECIMAL(5, 2) etc
 * @param {IColumnMetadataPostgres} columnMetadataPostgres
 * @returns {string} '(5, 2)'
 */
export const numericPrecisionScalePostgres = (columnMetadataPostgres: IColumnMetadataPostgres): string => {
    let res = `(${columnMetadataPostgres.numeric_precision}`;
    res +=  columnMetadataPostgres.numeric_scale ?
        `, ${columnMetadataPostgres.numeric_scale})` : `)`;
    return res;
};

/**
 * Compute date time precision signature: TIMESTAMP(3), DATETIME(6)
 * @param {IColumnMetadataPostgres} columnMetadataPostgres
 * @returns {string} '(3)'
 */
export const dateTimePrecisionPostgres = (columnMetadataPostgres: IColumnMetadataPostgres): string => {
    if (columnMetadataPostgres.datetime_precision) {
        return `(${columnMetadataPostgres.datetime_precision})`;
    }
    else {
        return '';
    }
};

export const toUpperCase = (s: string) => s.toUpperCase();
export const toLowerCase = (s: string) => s.toLowerCase();

/**
 * Return transformer for the provided case
 * @param  {Case} transformCase
 * @returns {function(s: string): string}
 */
export const getTransformer = (transformCase: Case): (s: string) => string => {
    let transformer: (s: string) => string;

    switch(transformCase) {
        case "CAMEL":
            transformer = camelCase;
            break;
        case "UPPER":
            transformer = toUpperCase;
            break;
        case "LOWER":
            transformer = toLowerCase;
            break;
        case "PASCAL":
            transformer = pascalCase;
            break;
        case "UNDERSCORE":
            transformer = snakeCase;
            break;
        case "CONST":
            transformer = constantCase;
            break;
        default:
            transformer = (s: string) => s;
    }

    return transformer;
}

/**
 * Transform ITableMetadata object using the provided case
 * @param {ITableMetadata} tableMetadata
 * @param {Case} transformCase
 * @returns {ITableMetadata}
 */
export const caseTransformer = (tableMetadata: ITableMetadata, transformCase: Case): ITableMetadata => {
    const transformer = getTransformer(transformCase);

    const transformed: ITableMetadata = {
        name: tableMetadata.name,
        modelName: transformer(tableMetadata.name),
        timestamps: tableMetadata.timestamps,
        columns: [],
        comment: tableMetadata.comment,
    };

    for (const col of tableMetadata.columns) {
        transformed.columns.push(Object.assign({}, col, { name: transformer(col.name), fieldName: col.name }));
    }

    return transformed;
}
