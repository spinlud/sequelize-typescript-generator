export const SCHEMA_NAME = process.env.TEST_DB_SCHEMA || 'public';
export const SCHEMA_DROP = `DROP SCHEMA IF EXISTS ${SCHEMA_NAME} CASCADE`;
export const SCHEMA_CREATE = `CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`;

export const DATA_TYPES_TABLE_NAME = 'data_types';
export const DATA_TYPES_TABLE_DROP = `DROP TABLE IF EXISTS ${SCHEMA_NAME}.${DATA_TYPES_TABLE_NAME} CASCADE`;
export const DATA_TYPES_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHEMA_NAME}.${DATA_TYPES_TABLE_NAME}
        (
            id            serial      not null      constraint data_types_pk        primary key,
            f_smallint    smallint,
            f_integer     integer,
            f_bigint      bigint,
            f_decimal     numeric(7, 3),
            f_numeric     numeric(5, 2)     DEFAULT 9.99,
            f_real        real,
            f_double      double precision,
            -- f_smallserial smallserial not null,
            -- f_serial      serial      not null,
            -- f_bigserial   bigserial   not null,
            f_money       money,
            f_varchar     varchar(80)       DEFAULT 'Morpheus',
            f_char        char(1),
            f_character   char(2),
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
            f_boolean     boolean,
            f_point       point,
            f_line        line,
            f_lseg        lseg,
            f_box         box,
            f_path        path,
            f_polygon     polygon,
            f_circle      circle,       
            f_json        json,
            f_jsonb       jsonb            
        )
    `,
];

export const INDICES_TABLE_NAME = 'indices';
export const INDICES_TABLE_DROP = `DROP TABLE IF EXISTS ${SCHEMA_NAME}.${INDICES_TABLE_NAME} CASCADE`;
export const INDICES_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHEMA_NAME}.${INDICES_TABLE_NAME}
        (
            id SERIAL       CONSTRAINT indices_pk       PRIMARY KEY,
            f_unique CHAR(1),
            f_multi_1 VARCHAR(3),
            f_multi_2 INT,
            f_not_unique CHAR(2)
        );        
    `,
    `
        CREATE UNIQUE INDEX indices_f_multi_1_f_multi_2_uindex
            ON ${SCHEMA_NAME}.${INDICES_TABLE_NAME} (f_multi_1, f_multi_2);
    `,
    `
        CREATE UNIQUE INDEX indices_f_multi_1_uindex
            ON ${SCHEMA_NAME}.${INDICES_TABLE_NAME} (f_multi_1);
    `,
    `
        CREATE INDEX indices_f_not_unique_index
            ON ${SCHEMA_NAME}.${INDICES_TABLE_NAME} (f_not_unique DESC);
    `,
    `
        CREATE UNIQUE INDEX indices_f_unique_uindex
            ON ${SCHEMA_NAME}.${INDICES_TABLE_NAME} (f_unique);
    `,
];

export const AUTHORS_TABLE_NAME = 'authors';
export const AUTHORS_TABLE_DROP = `DROP TABLE IF EXISTS ${AUTHORS_TABLE_NAME} CASCADE`;
export const AUTHORS_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHEMA_NAME}.${AUTHORS_TABLE_NAME}
        (
            author_id       INT             primary key,
            full_name       VARCHAR(80)     not null
        );
    `,
];
export const AUTHORS_TABLE_INSERTS = [
    `INSERT INTO ${SCHEMA_NAME}.${AUTHORS_TABLE_NAME} VALUES (1, 'Isasc Asimov');`,
    `INSERT INTO ${SCHEMA_NAME}.${AUTHORS_TABLE_NAME} VALUES (2, 'James Clavell');`,
];

export const BOOKS_TABLE_NAME = 'books';
export const BOOKS_TABLE_DROP = `DROP TABLE IF EXISTS ${BOOKS_TABLE_NAME} CASCADE`;
export const BOOKS_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHEMA_NAME}.${BOOKS_TABLE_NAME}
        (
            book_id         INT             PRIMARY KEY,
            title           VARCHAR(80)     not null
        );
    `,
];
export const BOOKS_TABLE_INSERTS = [
    `INSERT INTO ${SCHEMA_NAME}.${BOOKS_TABLE_NAME} VALUES (1, 'Prelude to Foundation');`,
    `INSERT INTO ${SCHEMA_NAME}.${BOOKS_TABLE_NAME} VALUES (2, 'The End of Eternity');`,
    `INSERT INTO ${SCHEMA_NAME}.${BOOKS_TABLE_NAME} VALUES (3, 'Shogun');`,
    `INSERT INTO ${SCHEMA_NAME}.${BOOKS_TABLE_NAME} VALUES (4, 'Galactic Shogun');`,
];

export const AUTHORS_BOOKS_TABLE_NAME = 'authors_books';
export const AUTHORS_BOOKS_TABLE_DROP = `DROP TABLE IF EXISTS ${AUTHORS_BOOKS_TABLE_NAME} CASCADE`;
export const AUTHORS_BOOKS_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHEMA_NAME}.${AUTHORS_BOOKS_TABLE_NAME}
        (
            author_id       INT             not null,
            book_id         INT             not null,
            PRIMARY KEY (author_id, book_id)
        );
    `,
];
export const AUTHORS_BOOKS_TABLE_INSERTS = [
    `INSERT INTO ${SCHEMA_NAME}.${AUTHORS_BOOKS_TABLE_NAME} VALUES (1, 1);`,
    `INSERT INTO ${SCHEMA_NAME}.${AUTHORS_BOOKS_TABLE_NAME} VALUES (1, 2);`,
    `INSERT INTO ${SCHEMA_NAME}.${AUTHORS_BOOKS_TABLE_NAME} VALUES (1, 4);`,
    `INSERT INTO ${SCHEMA_NAME}.${AUTHORS_BOOKS_TABLE_NAME} VALUES (2, 3);`,
    `INSERT INTO ${SCHEMA_NAME}.${AUTHORS_BOOKS_TABLE_NAME} VALUES (2, 4);`,
];

export const RACES_TABLE_NAME = 'races';
export const RACES_TABLE_DROP = `DROP TABLE IF EXISTS ${RACES_TABLE_NAME} CASCADE`;
export const RACES_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHEMA_NAME}.${RACES_TABLE_NAME}
        (
            race_id             INT             PRIMARY KEY,
            race_name           VARCHAR(80)     NOT NULL            
        );
    `,
];
export const RACES_TABLE_INSERTS = [
    `INSERT INTO ${SCHEMA_NAME}.${RACES_TABLE_NAME} VALUES(1, 'Orcs');`,
    `INSERT INTO ${SCHEMA_NAME}.${RACES_TABLE_NAME} VALUES(2, 'Humans');`,
    `INSERT INTO ${SCHEMA_NAME}.${RACES_TABLE_NAME} VALUES(3, 'Night Elves');`,
    `INSERT INTO ${SCHEMA_NAME}.${RACES_TABLE_NAME} VALUES(4, 'Undead');`,
];

export const UNITS_TABLE_NAME = 'units';
export const UNITS_TABLE_DROP = `DROP TABLE IF EXISTS ${UNITS_TABLE_NAME} CASCADE`;
export const UNITS_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHEMA_NAME}.${UNITS_TABLE_NAME}
        (
            unit_id             INT             PRIMARY KEY,
            unit_name           VARCHAR(80)     NOT NULL,
            race_id             INT             NOT NULL
        );
    `,
];
export const UNITS_TABLE_INSERTS = [
    `INSERT INTO ${SCHEMA_NAME}.${UNITS_TABLE_NAME} VALUES(1, 'Tauren Warrior', 1);`,
    `INSERT INTO ${SCHEMA_NAME}.${UNITS_TABLE_NAME} VALUES(2, 'Kodo Beast', 1);`,
    `INSERT INTO ${SCHEMA_NAME}.${UNITS_TABLE_NAME} VALUES(3, 'Rifleman', 2);`,
    `INSERT INTO ${SCHEMA_NAME}.${UNITS_TABLE_NAME} VALUES(4, 'Dryad', 3);`,
    `INSERT INTO ${SCHEMA_NAME}.${UNITS_TABLE_NAME} VALUES(5, 'Archer', 3);`,
    `INSERT INTO ${SCHEMA_NAME}.${UNITS_TABLE_NAME} VALUES(6, 'Ghoul', 4);`,
    `INSERT INTO ${SCHEMA_NAME}.${UNITS_TABLE_NAME} VALUES(7, 'Frost Wyrm', 4);`,
];

export const PERSON_TABLE_NAME = 'person';
export const PERSON_TABLE_DROP = `DROP TABLE IF EXISTS ${PERSON_TABLE_NAME} CASCADE`;
export const PERSON_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHEMA_NAME}.${PERSON_TABLE_NAME}
        (
            person_id           INT             PRIMARY KEY,
            name                VARCHAR(80)     NOT NULL,
            passport_id         INT             NOT NULL
        );
    `,
];
export const PERSON_TABLE_INSERTS = [
    `INSERT INTO ${SCHEMA_NAME}.${PERSON_TABLE_NAME} VALUES(1, 'Arthas', 1);`,
];

export const PASSPORT_TABLE_NAME = 'passport';
export const PASSPORT_TABLE_DROP = `DROP TABLE IF EXISTS ${PASSPORT_TABLE_NAME} CASCADE`;
export const PASSPORT_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHEMA_NAME}.${PASSPORT_TABLE_NAME}
        (
            passport_id         INT             PRIMARY KEY,
            code                VARCHAR(80)     NOT NULL            
        );
    `,
];
export const PASSPORT_TABLE_INSERTS = [
    `INSERT INTO ${SCHEMA_NAME}.${PASSPORT_TABLE_NAME} VALUES(1, 'Frostmourne');`,
];
