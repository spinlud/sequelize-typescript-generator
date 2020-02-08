export const DATA_TYPES_TABLE_NAME = 'data_types';
export const DATA_TYPES_TABLE_DROP = `DROP TABLE IF EXISTS ${DATA_TYPES_TABLE_NAME};`;
export const DATA_TYPES_TABLE_CREATE = `
    CREATE TABLE ${DATA_TYPES_TABLE_NAME}
    (
        id INTEGER      CONSTRAINT data_types_pk        PRIMARY KEY         AUTOINCREMENT,
        f_int INTEGER,
        f_integer INTEGER,
        f_tinyint TINYINT,
        f_smallint SMALLINT,
        f_mediumint MEDIUMINT,
        f_bigint BIGINT,
        f_unsigned_big_int UNSIGNED BIG SHIT,
        f_int2 INT2,
        f_int8 INT8,
        f_real REAL,
        f_double DOUBLE,
        f_double_precision DOUBLE PRECISION,
        f_float FLOAT,
        f_numeric NUMERIC(7,2),
        f_decimal DECIMAL(6,2),
        f_date XYZ,
        f_datetime DATETIME,
        f_timestamp TIMESTAMP,
        f_time TIME,
        f_varchar VARCHAR(80),
        f_character CHARACTER(1),
        f_varying_character VARYING CHARACTER,
        f_nchar NCHAR(1),
        f_native_character NATIVE CHARACTER,
        f_nvarchar NVARCHAR,
        f_text TEXT,
        f_clob CLOB,
        f_boolean BOOLEAN,
        f_blob BLOB
    );
`;

export const INDICES_TABLE_NAME = 'indices';
export const INDICES_TABLE_DROP = `DROP TABLE IF EXISTS ${INDICES_TABLE_NAME}`;
export const INDICES_TABLE_CREATE = `
    CREATE TABLE ${INDICES_TABLE_NAME}
    (
        id INTEGER      CONSTRAINT indices_pk       PRIMARY KEY         AUTOINCREMENT,
        f_unique INTEGER not null,
        f_multi_1 INTEGER,
        f_multi_2 VARCHAR(80),
        f_not_unique INTEGER
    );
`;

export const INDICES_TABLE_CREATE_INDEX_1 = `
    CREATE UNIQUE INDEX indices_f_multi_1_f_multi_2_uindex
        ON ${INDICES_TABLE_NAME} (f_multi_1, f_multi_2);
`;

export const INDICES_TABLE_CREATE_INDEX_2 = `
    CREATE UNIQUE INDEX indices_f_multi_1_uindex
        ON ${INDICES_TABLE_NAME} (f_multi_1);
`;

export const INDICES_TABLE_CREATE_INDEX_3 = `
    CREATE INDEX indices_f_not_unique_index
        ON ${INDICES_TABLE_NAME} (f_not_unique);
`;

export const INDICES_TABLE_CREATE_INDEX_4 = `
    CREATE UNIQUE INDEX indices_f_unique_uindex
        ON ${INDICES_TABLE_NAME} (f_unique);
`;
