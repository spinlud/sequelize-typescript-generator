export const DATA_TYPES_TABLE_NAME = 'データ型'; // 'data types' in japanese, for testing non ASCII string on MSSQL
export const DATA_TYPES_TABLE_DROP = `DROP TABLE IF EXISTS ${DATA_TYPES_TABLE_NAME}`;
export const DATA_TYPES_TABLE_CREATES = [
    `
        CREATE TABLE ${DATA_TYPES_TABLE_NAME}
        (
            id                 INT identity         constraint data_types_pk        primary key nonclustered,
            f_int              INT,
            f_整数              INTEGER,
            f_bigint           BIGINT,
            f_tinyint          TINYINT,
            f_smallint         SMALLINT,       
            f_numeric          NUMERIC(7, 2),
            f_decimal          DECIMAL(5, 2),
            f_float            FLOAT,
            f_real             REAL,
            f_dec              DEC(5, 2),
            f_money            MONEY,
            f_char             CHAR(1),
            f_character        CHARACTER(1),
            f_nchar            NCHAR,
            f_varchar          VARCHAR(80),
            f_nvarchar         NVARCHAR(80),
            f_text             TEXT,
            f_ntext            NTEXT,
            f_double           DOUBLE PRECISION,
            f_date             DATE,
            f_datetime         DATETIME,
            f_datetime2        DATETIME2,
            f_datetimeoffset   DATETIMEOFFSET,
            f_time             TIME,        
            f_smalldatetime    SMALLDATETIME,
            f_smallmoney       SMALLMONEY,
            f_binary           BINARY(16),
            f_bit              BIT,
            f_uniqueidentifier UNIQUEIDENTIFIER,
            f_xml              XML,
            f_varbinary        VARBINARY(16)
        );    
    `,
];

export const INDICES_TABLE_NAME = 'indices';
export const INDICES_TABLE_DROP = `DROP TABLE IF EXISTS ${INDICES_TABLE_NAME}`;
export const INDICES_TABLE_CREATES = [
    `
        create table indices
        (
            id INT              identity            constraint indices_pk       primary key nonclustered,
            f_unique            INT,
            f_multi_1           VARCHAR(80)         not null,
            f_multi_2           INT,
            f_not_unique        INT
        );
    `,
    `
        CREATE UNIQUE INDEX indices_f_unique_uindex
            ON indices (f_unique);
    `,
    `
        CREATE UNIQUE INDEX indices_f_multi_1_f_multi_2_uindex
            ON indices (f_multi_1, f_multi_2);
    `,
    `
        CREATE INDEX indices_f_not_unique_index
            ON indices (f_not_unique);
    `,
    `
        CREATE UNIQUE INDEX indices_f_multi_1_uindex
            ON indices (f_multi_1);
    `,
];

export const AUTHORS_TABLE_NAME = 'authors';
export const AUTHORS_TABLE_DROP = `DROP TABLE IF EXISTS ${AUTHORS_TABLE_NAME}`;
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
export const BOOKS_TABLE_DROP = `DROP TABLE IF EXISTS ${BOOKS_TABLE_NAME}`;
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
export const AUTHORS_BOOKS_TABLE_DROP = `DROP TABLE IF EXISTS ${AUTHORS_BOOKS_TABLE_NAME}`;
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
export const RACES_TABLE_DROP = `DROP TABLE IF EXISTS ${RACES_TABLE_NAME}`;
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
export const UNITS_TABLE_DROP = `DROP TABLE IF EXISTS ${UNITS_TABLE_NAME}`;
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
export const PERSON_TABLE_DROP = `DROP TABLE IF EXISTS ${PERSON_TABLE_NAME}`;
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
export const PASSPORT_TABLE_DROP = `DROP TABLE IF EXISTS ${PASSPORT_TABLE_NAME}`;
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


export const HORSE_TABLE_NAME = 'horse';
export const HORSE_TABLE_DROP = `DROP TABLE IF EXISTS ${HORSE_TABLE_NAME}`;
export const HORSE_TABLE_CREATES = [
    `
        CREATE TABLE ${HORSE_TABLE_NAME}
        (
            horse_id            INT             PRIMARY KEY,
            horse_name          VARCHAR(30)     NOT NULL,
            horse_status_id     INT             NOT NULL,
            horse_color_id      INT             NOT NULL,
            horse_breed_id      INT             NOT NULL,
            horse_gender_id     INT             NOT NULL
        );
    `,
];
export const HORSE_TABLE_INSERTS = [
    `INSERT INTO ${HORSE_TABLE_NAME} VALUES(1, 'Sunshine', 12, 2, 11, 6);`,
    `INSERT INTO ${HORSE_TABLE_NAME} VALUES(2, 'Lightning', 13, 5, 9, 7);`,
];

export const CODELOOKUP_TABLE_NAME = 'codeLookup';
export const CODELOOKUP_TABLE_DROP = `DROP TABLE IF EXISTS ${CODELOOKUP_TABLE_NAME}`;
export const CODELOOKUP_TABLE_CREATES = [
    `
        CREATE TABLE ${CODELOOKUP_TABLE_NAME}
        (
            code_lookup_id      INT             PRIMARY KEY,
            code_value          VARCHAR(80)     NOT NULL
        );
    `,
];
export const CODELOOKUP_TABLE_INSERTS = [
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(1, 'Palamino');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(2, 'Chestnut');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(3, 'Black');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(4, 'Brown');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(5, 'White');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(6, 'Female');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(7, 'Male');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(8, 'Clydesdale');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(9, 'Arabian');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(10, 'Belgian');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(11, 'Morgan');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(12, 'Active');`,
    `INSERT INTO ${CODELOOKUP_TABLE_NAME} VALUES(13, 'Inactive');`,
];

export const STUDENT_TABLE_NAME = 'student';
export const STUDENT_TABLE_DROP = `DROP TABLE IF EXISTS ${STUDENT_TABLE_NAME}`;
export const STUDENT_TABLE_CREATES = [
    `
        CREATE TABLE ${STUDENT_TABLE_NAME}
        (
            student_id          INT             PRIMARY KEY,
            name                VARCHAR(80)     NOT NULL,
            scholarship_id      INT             NOT NULL
        );
    `,
];
export const STUDENT_TABLE_INSERTS = [
    `INSERT INTO ${STUDENT_TABLE_NAME} VALUES(1, 'Joe', 1);`,
];

export const SCHOLARSHIP_TABLE_NAME = 'scholarship';
export const SCHOLARSHIP_TABLE_DROP = `DROP TABLE IF EXISTS ${SCHOLARSHIP_TABLE_NAME}`;
export const SCHOLARSHIP_TABLE_CREATES = [
    `
        CREATE TABLE ${SCHOLARSHIP_TABLE_NAME}
        (
            scholarship_id      INT             PRIMARY KEY,
            sponsor_name        VARCHAR(80)     NOT NULL,
            amount              DECIMAL(5, 2)   NOT NULL
        );
    `,
];
export const SCHOLARSHIP_TABLE_INSERTS = [
    `INSERT INTO ${SCHOLARSHIP_TABLE_NAME} VALUES(1, 'MyBank', 603.47);`,
];









export const WORKERS_TABLE_NAME = 'workers';
export const WORKERS_TABLE_DROP = `DROP TABLE IF EXISTS ${WORKERS_TABLE_NAME}`;
export const WORKERS_TABLE_CREATES = [
    `
        CREATE TABLE ${WORKERS_TABLE_NAME}
        (
            worker_id           INT             primary key,
            full_name           VARCHAR(80)     not null
        );
    `,
];
export const WORKERS_TABLE_INSERTS = [
    `INSERT INTO ${WORKERS_TABLE_NAME} VALUES (1, 'Lefty Smith');`,
    `INSERT INTO ${WORKERS_TABLE_NAME} VALUES (2, 'Happy Jones');`,
];

export const SHIFT_TABLE_NAME = 'shift';
export const SHIFT_TABLE_DROP = `DROP TABLE IF EXISTS ${SHIFT_TABLE_NAME}`;
export const SHIFT_TABLE_CREATES = [
    `
        CREATE TABLE ${SHIFT_TABLE_NAME}
        (
            shift_id            INT             PRIMARY KEY,
            name                VARCHAR(10)     NOT NULL,
            start_time          TIME        NOT NULL,
            end_time            TIME        NOT NULL
        );
    `,
];
export const SHIFT_TABLE_INSERTS = [
    `INSERT INTO ${SHIFT_TABLE_NAME} VALUES (1, 'Morning', '05:00', '11:00');`,
    `INSERT INTO ${SHIFT_TABLE_NAME} VALUES (2, 'Lunch', '11:00', '17:00');`,
    `INSERT INTO ${SHIFT_TABLE_NAME} VALUES (3, 'Dinner', '17:00', '23:00');`,
    `INSERT INTO ${SHIFT_TABLE_NAME} VALUES (4, 'Night', '23:00', '05:00');`,
];

export const WORKERS_SHIFTS_TABLE_NAME = 'worker_shift';
export const WORKERS_SHIFTS_TABLE_DROP = `DROP TABLE IF EXISTS ${WORKERS_SHIFTS_TABLE_NAME}`;
export const WORKERS_SHIFTS_TABLE_CREATES = [
    `
        CREATE TABLE ${WORKERS_SHIFTS_TABLE_NAME}
        (
            worker_id       INT             not null,
            shift_id        INT             not null,
            PRIMARY KEY (worker_id, shift_id)
        );
    `,
];
export const WORKERS_SHIFTS_TABLE_INSERTS = [
    `INSERT INTO ${WORKERS_SHIFTS_TABLE_NAME} VALUES (1, 1);`,
    `INSERT INTO ${WORKERS_SHIFTS_TABLE_NAME} VALUES (1, 2);`,
    `INSERT INTO ${WORKERS_SHIFTS_TABLE_NAME} VALUES (1, 4);`,
    `INSERT INTO ${WORKERS_SHIFTS_TABLE_NAME} VALUES (2, 3);`,
    `INSERT INTO ${WORKERS_SHIFTS_TABLE_NAME} VALUES (2, 4);`,
];



