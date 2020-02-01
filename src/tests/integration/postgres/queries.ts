export const SCHEMA_NAME = process.env.TEST_DB_SCHEMA || 'public';
export const SCHEMA_DROP = `DROP SCHEMA IF EXISTS ${SCHEMA_NAME} CASCADE`;
export const SCHEMA_CREATE = `CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`;

export const DATA_TYPES_TABLE_NAME = 'data_types';
export const DATA_TYPES_TABLE_DROP = `DROP TABLE IF EXISTS ${SCHEMA_NAME}.${DATA_TYPES_TABLE_NAME} CASCADE`;
export const DATA_TYPES_TABLE_CREATE = `
    CREATE TABLE ${SCHEMA_NAME}.${DATA_TYPES_TABLE_NAME}
    (
        id            serial      not null      constraint data_types_pk        primary key,
        f_smallint    smallint,
        f_integer     integer,
        f_bigint      bigint,
        f_decimal     numeric(7, 3),
        f_numeric     numeric(5, 2),
        f_real        real,
        f_double      double precision,
        -- f_smallserial smallserial not null,
        -- f_serial      serial      not null,
        -- f_bigserial   bigserial   not null,
        f_money       money,
        f_varchar     varchar(80),
        f_char        char,
        f_character   char,
        f_text        text,
        f_cidr        cidr,
        f_inet        inet,
        f_macaddr     macaddr,
        f_macaddr8    macaddr8,
        f_bit         bit,
        f_varbit      bit varying,
        f_uuid        uuid,
        f_xml         xml,
        f_bytea       bytea,
        f_timestamp   timestamp(6),
        f_timestamptz timestamptz,
        f_date        date,
        f_time        time,
        f_timetz      timetz,
        -- f_interval    interval,
        f_boolean     boolean,
        f_point       point,
        f_line        line,
        f_lseg        lseg,
        f_box         box,
        f_path        path,
        f_polygon     polygon,
        f_circle      circle,       
        f_json        json,
        f_jsonb       jsonb,
        f_jsonpath    jsonpath
    )
`;

export const INDICES_TABLE_NAME = 'indices';
export const INDICES_TABLE_DROP = `DROP TABLE IF EXISTS ${SCHEMA_NAME}.${INDICES_TABLE_NAME} CASCADE`;
export const INDICES_TABLE_CREATE = `
    CREATE TABLE ${SCHEMA_NAME}.${INDICES_TABLE_NAME}
    (
        id SERIAL       CONSTRAINT indices_pk       PRIMARY KEY,
        f_unique CHAR(1),
        f_multi_1 VARCHAR(3),
        f_multi_2 INT,
        f_not_unique CHAR(2)
    );

    CREATE UNIQUE INDEX indices_f_multi_1_f_multi_2_uindex
        ON ${SCHEMA_NAME}.${INDICES_TABLE_NAME} (f_multi_1, f_multi_2);

    CREATE UNIQUE INDEX indices_f_multi_1_uindex
        ON ${SCHEMA_NAME}.${INDICES_TABLE_NAME} (f_multi_1);

    CREATE INDEX indices_f_not_unique_index
        ON ${SCHEMA_NAME}.${INDICES_TABLE_NAME} (f_not_unique DESC);

    CREATE UNIQUE INDEX indices_f_unique_uindex
        ON ${SCHEMA_NAME}.${INDICES_TABLE_NAME} (f_unique);
`;
