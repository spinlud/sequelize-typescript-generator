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

export const JSON_TYPES_TABLE_NAME = 'json_types';
export const JSON_TYPES_TABLE_DROP = `DROP TABLE IF EXISTS ${JSON_TYPES_TABLE_NAME} CASCADE`;
export const JSON_TYPES_TABLE_CREATES = [
    `
        CREATE TABLE ${JSON_TYPES_TABLE_NAME}
        (
            id                INT        AUTO_INCREMENT    PRIMARY KEY,
            f_json            JSON       NULL,
            f_plain_longtext  LONGTEXT   NULL
        )
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
export const AUTHORS_FULL_NAME_COMMENT = 'Full name of the author';
export const AUTHORS_TABLE_DROP = `DROP TABLE IF EXISTS ${AUTHORS_TABLE_NAME} CASCADE`;
export const AUTHORS_TABLE_CREATES = [
    `
        CREATE TABLE ${AUTHORS_TABLE_NAME}
        (
            author_id       INT             primary key,
            full_name       VARCHAR(80)     not null     COMMENT '${AUTHORS_FULL_NAME_COMMENT}'
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
            race_id             INT             NOT NULL,
            CONSTRAINT units_race_id_fk FOREIGN KEY (race_id)
                REFERENCES ${RACES_TABLE_NAME}(race_id) ON DELETE CASCADE ON UPDATE RESTRICT
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

export const EMPLOYEES_TABLE_NAME = 'employees';
export const EMPLOYEES_TABLE_DROP = `DROP TABLE IF EXISTS ${EMPLOYEES_TABLE_NAME} CASCADE`;
export const EMPLOYEES_TABLE_CREATES = [
    `
        CREATE TABLE ${EMPLOYEES_TABLE_NAME}
        (
            employee_id     INT             PRIMARY KEY,
            name            VARCHAR(80)     NOT NULL,
            manager_id      INT,
            CONSTRAINT employees_manager_fk FOREIGN KEY (manager_id)
                REFERENCES ${EMPLOYEES_TABLE_NAME}(employee_id) ON DELETE SET NULL ON UPDATE RESTRICT
        );
    `,
];
export const EMPLOYEES_TABLE_INSERTS = [
    `INSERT INTO ${EMPLOYEES_TABLE_NAME} VALUES(1, 'Grand Admiral', NULL);`,
    `INSERT INTO ${EMPLOYEES_TABLE_NAME} VALUES(2, 'Captain', 1);`,
];

export const PROFILES_TABLE_NAME = 'profiles';
export const PROFILES_TABLE_DROP = `DROP TABLE IF EXISTS ${PROFILES_TABLE_NAME} CASCADE`;
export const PROFILES_TABLE_CREATES = [
    `
        CREATE TABLE ${PROFILES_TABLE_NAME}
        (
            profile_id      INT             PRIMARY KEY,
            person_id       INT             NOT NULL     UNIQUE,
            CONSTRAINT profiles_person_fk FOREIGN KEY (person_id)
                REFERENCES ${PERSON_TABLE_NAME}(person_id) ON DELETE CASCADE ON UPDATE CASCADE
        );
    `,
];
export const PROFILES_TABLE_INSERTS = [
    `INSERT INTO ${PROFILES_TABLE_NAME} VALUES(1, 1);`,
];

export const ORDER_LINES_TABLE_NAME = 'order_lines';
export const ORDER_LINES_TABLE_DROP = `DROP TABLE IF EXISTS ${ORDER_LINES_TABLE_NAME} CASCADE`;
export const ORDER_LINES_TABLE_CREATES = [
    `
        CREATE TABLE ${ORDER_LINES_TABLE_NAME}
        (
            order_line_id   INT             PRIMARY KEY,
            order_id        INT             NOT NULL,
            line_no         INT             NOT NULL,
            CONSTRAINT order_lines_uk UNIQUE (order_id, line_no)
        );
    `,
];
export const ORDER_LINES_TABLE_INSERTS = [
    `INSERT INTO ${ORDER_LINES_TABLE_NAME} VALUES(1, 1, 1);`,
    `INSERT INTO ${ORDER_LINES_TABLE_NAME} VALUES(2, 1, 2);`,
];

export const SHIPMENTS_TABLE_NAME = 'shipments';
export const SHIPMENTS_TABLE_DROP = `DROP TABLE IF EXISTS ${SHIPMENTS_TABLE_NAME} CASCADE`;
export const SHIPMENTS_TABLE_CREATES = [
    `
        CREATE TABLE ${SHIPMENTS_TABLE_NAME}
        (
            shipment_id     INT             PRIMARY KEY,
            order_id        INT             NOT NULL,
            line_no         INT             NOT NULL,
            CONSTRAINT shipments_order_line_fk FOREIGN KEY (order_id, line_no)
                REFERENCES ${ORDER_LINES_TABLE_NAME}(order_id, line_no)
                ON DELETE RESTRICT ON UPDATE RESTRICT
        );
    `,
];
export const SHIPMENTS_TABLE_INSERTS = [
    `INSERT INTO ${SHIPMENTS_TABLE_NAME} VALUES(1, 1, 1);`,
];

export const SOFT_DELETES_TABLE_NAME = 'soft_deletes';
export const SOFT_DELETES_TABLE_DROP = `DROP TABLE IF EXISTS ${SOFT_DELETES_TABLE_NAME} CASCADE`;
export const SOFT_DELETES_TABLE_CREATES = [
    `
        CREATE TABLE ${SOFT_DELETES_TABLE_NAME}
        (
            id              INT             PRIMARY KEY,
            name            VARCHAR(80)     NOT NULL,
            createdAt       DATETIME        NULL     DEFAULT NULL,
            updatedAt       DATETIME        NULL     DEFAULT NULL,
            deleted_at      TIMESTAMP       NULL     DEFAULT NULL
        );
    `,
];
