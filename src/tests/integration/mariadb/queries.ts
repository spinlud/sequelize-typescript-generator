export const DATA_TYPES_TABLE_NAME = 'data_types';
export const DATA_TYPES_TABLE_DROP = `DROP TABLE IF EXISTS ${DATA_TYPES_TABLE_NAME} CASCADE`;
export const DATA_TYPES_TABLE_CREATES = [
    `
        CREATE TABLE ${DATA_TYPES_TABLE_NAME}
        (
            id                   INT                  AUTO_INCREMENT          PRIMARY KEY,  
            f_bit                BIT(7)               null,        
            f_bigint             BIGINT               null,
            f_smallint           SMALLINT             null,
            f_mediumint          MEDIUMINT            null,
            f_tinyint            TINYINT              null,
            f_decimal            DECIMAL(7, 3)        null,
            f_float              FLOAT(5, 3)          null,
            f_double             DOUBLE(7, 4)         null,
            f_int                INT                  null,
            f_varchar            VARCHAR(80)          null,
            f_char               CHAR(10)             null,
            f_tinytext           TINYTEXT             null,
            f_mediumtext         MEDIUMTEXT           null,
            f_longtext           LONGTEXT             null,
            f_text               TEXT                 null,        
            f_date               DATE                 null,
            f_time               TIME                 null,
            f_datetime           DATETIME(6)          null,
            f_timestamp          TIMESTAMP(3)         null,
            f_year               YEAR                 null,        
            f_enum               ENUM ('AA', 'BB')    null,
            f_set                SET ('X', 'Y')       null,                
            f_binary             BINARY               null,
            f_blob               BLOB                 null,
            f_tinyblob           TINYBLOB             null,
            f_mediumblob         MEDIUMBLOB           null,
            f_longblob           LONGBLOB             null,
            f_point              POINT                null,
            f_multipoint         MULTIPOINT           null,
            f_linestring         LINESTRING           null,
            f_multilinestring    MULTILINESTRING      null,
            f_polygon            POLYGON              null,
            f_multipolygon       MULTIPOLYGON         null,
            f_geometry           GEOMETRY             null,        
            f_json               JSON                 null
        ) CHARSET = 'latin1'
    `,
];

export const INDICES_TABLE_NAME = 'indices';
export const INDICES_TABLE_DROP = `DROP TABLE IF EXISTS ${INDICES_TABLE_NAME} CASCADE`;
export const INDICES_TABLE_CREATES = [
    `
        CREATE TABLE ${INDICES_TABLE_NAME}
        (
            id              int             auto_increment          primary key,
            f_unique        bigint          null,
            f_multi_1       int not         null,
            f_multi_2       varchar(80)     null,
            CONSTRAINT indices_f_multi_1_uindex UNIQUE (f_multi_1),
            CONSTRAINT indices_f_unique_uindex UNIQUE (f_unique)
        ) CHARSET = 'latin1'
    `,
    `
        CREATE INDEX indices_f_multi_1_f_multi_2_index
            ON ${INDICES_TABLE_NAME} (f_multi_1, f_multi_2);
    `,
];

export const AUTHORS_TABLE_NAME = 'authors';
export const AUTHORS_TABLE_DROP = `DROP TABLE IF EXISTS ${AUTHORS_TABLE_NAME} CASCADE`;
export const AUTHORS_TABLE_CREATES = [
    `
        CREATE TABLE ${AUTHORS_TABLE_NAME}
        (
            author_id       INT             primary key,
            full_name       VARCHAR(80)     not null
        );
    `,
];
export const AUTHORS_TABLE_INSERTS = [
    `INSERT INTO ${AUTHORS_TABLE_NAME} VALUES (1, 'Isasc Asimov');`,
    `INSERT INTO ${AUTHORS_TABLE_NAME} VALUES (2, 'James Clavell');`,
];

export const BOOKS_TABLE_NAME = 'books';
export const BOOKS_TABLE_DROP = `DROP TABLE IF EXISTS ${BOOKS_TABLE_NAME} CASCADE`;
export const BOOKS_TABLE_CREATES = [
    `
        CREATE TABLE ${BOOKS_TABLE_NAME}
        (
            book_id         INT             PRIMARY KEY,
            title           VARCHAR(80)     not null
        );
    `,
];
export const BOOKS_TABLE_INSERTS = [
    `INSERT INTO ${BOOKS_TABLE_NAME} VALUES (1, 'Prelude to Foundation');`,
    `INSERT INTO ${BOOKS_TABLE_NAME} VALUES (2, 'The End of Eternity');`,
    `INSERT INTO ${BOOKS_TABLE_NAME} VALUES (3, 'Shogun');`,
    `INSERT INTO ${BOOKS_TABLE_NAME} VALUES (4, 'Galactic Shogun');`,
];

export const AUTHORS_BOOKS_TABLE_NAME = 'authors_books';
export const AUTHORS_BOOKS_TABLE_DROP = `DROP TABLE IF EXISTS ${AUTHORS_BOOKS_TABLE_NAME} CASCADE`;
export const AUTHORS_BOOKS_TABLE_CREATES = [
    `
        CREATE TABLE ${AUTHORS_BOOKS_TABLE_NAME}
        (
            author_id       INT             not null,
            book_id         INT             not null,
            PRIMARY KEY (author_id, book_id)
        );
    `,
];
export const AUTHORS_BOOKS_TABLE_INSERTS = [
    `INSERT INTO ${AUTHORS_BOOKS_TABLE_NAME} VALUES (1, 1);`,
    `INSERT INTO ${AUTHORS_BOOKS_TABLE_NAME} VALUES (1, 2);`,
    `INSERT INTO ${AUTHORS_BOOKS_TABLE_NAME} VALUES (1, 4);`,
    `INSERT INTO ${AUTHORS_BOOKS_TABLE_NAME} VALUES (2, 3);`,
    `INSERT INTO ${AUTHORS_BOOKS_TABLE_NAME} VALUES (2, 4);`,
];

export const RACES_TABLE_NAME = 'races';
export const RACES_TABLE_DROP = `DROP TABLE IF EXISTS ${RACES_TABLE_NAME} CASCADE`;
export const RACES_TABLE_CREATES = [
    `
        CREATE TABLE ${RACES_TABLE_NAME}
        (
            race_id             INT             PRIMARY KEY,
            race_name           VARCHAR(80)     NOT NULL            
        );
    `,
];
export const RACES_TABLE_INSERTS = [
    `INSERT INTO ${RACES_TABLE_NAME} VALUES(1, 'Orcs');`,
    `INSERT INTO ${RACES_TABLE_NAME} VALUES(2, 'Humans');`,
    `INSERT INTO ${RACES_TABLE_NAME} VALUES(3, 'Night Elves');`,
    `INSERT INTO ${RACES_TABLE_NAME} VALUES(4, 'Undead');`,
];

export const UNITS_TABLE_NAME = 'units';
export const UNITS_TABLE_DROP = `DROP TABLE IF EXISTS ${UNITS_TABLE_NAME} CASCADE`;
export const UNITS_TABLE_CREATES = [
    `
        CREATE TABLE ${UNITS_TABLE_NAME}
        (
            unit_id             INT             PRIMARY KEY,
            unit_name           VARCHAR(80)     NOT NULL,
            race_id             INT             NOT NULL
        );
    `,
];
export const UNITS_TABLE_INSERTS = [
    `INSERT INTO ${UNITS_TABLE_NAME} VALUES(1, 'Tauren Warrior', 1);`,
    `INSERT INTO ${UNITS_TABLE_NAME} VALUES(2, 'Kodo Beast', 1);`,
    `INSERT INTO ${UNITS_TABLE_NAME} VALUES(3, 'Rifleman', 2);`,
    `INSERT INTO ${UNITS_TABLE_NAME} VALUES(4, 'Dryad', 3);`,
    `INSERT INTO ${UNITS_TABLE_NAME} VALUES(5, 'Archer', 3);`,
    `INSERT INTO ${UNITS_TABLE_NAME} VALUES(6, 'Ghoul', 4);`,
    `INSERT INTO ${UNITS_TABLE_NAME} VALUES(7, 'Frost Wyrm', 4);`,
];

export const PERSON_TABLE_NAME = 'person';
export const PERSON_TABLE_DROP = `DROP TABLE IF EXISTS ${PERSON_TABLE_NAME} CASCADE`;
export const PERSON_TABLE_CREATES = [
    `
        CREATE TABLE ${PERSON_TABLE_NAME}
        (
            person_id           INT             PRIMARY KEY,
            name                VARCHAR(80)     NOT NULL,
            passport_id         INT             NOT NULL
        );
    `,
];
export const PERSON_TABLE_INSERTS = [
    `INSERT INTO ${PERSON_TABLE_NAME} VALUES(1, 'Arthas', 1);`,
];

export const PASSPORT_TABLE_NAME = 'passport';
export const PASSPORT_TABLE_DROP = `DROP TABLE IF EXISTS ${PASSPORT_TABLE_NAME} CASCADE`;
export const PASSPORT_TABLE_CREATES = [
    `
        CREATE TABLE ${PASSPORT_TABLE_NAME}
        (
            passport_id         INT             PRIMARY KEY,
            code                VARCHAR(80)     NOT NULL            
        );
    `,
];
export const PASSPORT_TABLE_INSERTS = [
    `INSERT INTO ${PASSPORT_TABLE_NAME} VALUES(1, 'Frostmourne');`,
];

export const AUTHORS_VIEW_NAME = 'authors_view';
export const AUTHORS_VIEW_DROP = `DROP VIEW IF EXISTS ${AUTHORS_VIEW_NAME}`;
export const AUTHORS_VIEW_CREATES = [
    `CREATE OR REPLACE VIEW ${AUTHORS_VIEW_NAME} AS SELECT full_name FROM ${AUTHORS_TABLE_NAME}`,
];
