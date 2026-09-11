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
export const AUTHORS_FULL_NAME_COMMENT = 'Full name of the author';
export const AUTHORS_TABLE_DROP = `DROP TABLE IF EXISTS ${AUTHORS_TABLE_NAME}`;
export const AUTHORS_TABLE_CREATES = [
    `
        CREATE TABLE ${AUTHORS_TABLE_NAME}
        (
            author_id       INT             primary key,
            full_name       VARCHAR(80)     not null
        );
    `,
    `
        EXEC sp_addextendedproperty
            @name = N'MS_Description', @value = N'${AUTHORS_FULL_NAME_COMMENT}',
            @level0type = N'SCHEMA', @level0name = N'dbo',
            @level1type = N'TABLE',  @level1name = N'${AUTHORS_TABLE_NAME}',
            @level2type = N'COLUMN', @level2name = N'full_name';
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
            race_id             INT             NOT NULL,
            CONSTRAINT units_race_id_fk FOREIGN KEY (race_id)
                REFERENCES ${RACES_TABLE_NAME}(race_id) ON DELETE CASCADE ON UPDATE NO ACTION
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

export const EMPLOYEES_TABLE_NAME = 'employees';
export const EMPLOYEES_TABLE_DROP = `DROP TABLE IF EXISTS ${EMPLOYEES_TABLE_NAME}`;
export const EMPLOYEES_TABLE_CREATES = [
    `
        CREATE TABLE ${EMPLOYEES_TABLE_NAME}
        (
            employee_id     INT             PRIMARY KEY,
            name            VARCHAR(80)     NOT NULL,
            manager_id      INT,
            CONSTRAINT employees_manager_fk FOREIGN KEY (manager_id)
                REFERENCES ${EMPLOYEES_TABLE_NAME}(employee_id) ON DELETE NO ACTION ON UPDATE NO ACTION
        );
    `,
];
export const EMPLOYEES_TABLE_INSERTS = [
    `INSERT INTO ${EMPLOYEES_TABLE_NAME} VALUES(1, 'Grand Admiral', NULL);`,
    `INSERT INTO ${EMPLOYEES_TABLE_NAME} VALUES(2, 'Captain', 1);`,
];

export const PROFILES_TABLE_NAME = 'profiles';
export const PROFILES_TABLE_DROP = `DROP TABLE IF EXISTS ${PROFILES_TABLE_NAME}`;
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
export const ORDER_LINES_TABLE_DROP = `DROP TABLE IF EXISTS ${ORDER_LINES_TABLE_NAME}`;
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
export const SHIPMENTS_TABLE_DROP = `DROP TABLE IF EXISTS ${SHIPMENTS_TABLE_NAME}`;
export const SHIPMENTS_TABLE_CREATES = [
    `
        CREATE TABLE ${SHIPMENTS_TABLE_NAME}
        (
            shipment_id     INT             PRIMARY KEY,
            order_id        INT             NOT NULL,
            line_no         INT             NOT NULL,
            CONSTRAINT shipments_order_line_fk FOREIGN KEY (order_id, line_no)
                REFERENCES ${ORDER_LINES_TABLE_NAME}(order_id, line_no)
                ON DELETE NO ACTION ON UPDATE NO ACTION
        );
    `,
];
export const SHIPMENTS_TABLE_INSERTS = [
    `INSERT INTO ${SHIPMENTS_TABLE_NAME} VALUES(1, 1, 1);`,
];

export const SOFT_DELETES_TABLE_NAME = 'soft_deletes';
export const SOFT_DELETES_TABLE_DROP = `DROP TABLE IF EXISTS ${SOFT_DELETES_TABLE_NAME}`;
export const SOFT_DELETES_TABLE_CREATES = [
    `
        CREATE TABLE ${SOFT_DELETES_TABLE_NAME}
        (
            id              INT             PRIMARY KEY,
            name            NVARCHAR(50)    NOT NULL,
            createdAt       DATETIME2       NULL,
            updatedAt       DATETIME2       NULL,
            deleted_at      DATETIME2       NULL
        );
    `,
];

export const AUDITED_TABLE_NAME = 'audited';
export const AUDITED_TABLE_DROP = `DROP TABLE IF EXISTS ${AUDITED_TABLE_NAME}`;
export const AUDITED_TABLE_CREATES = [
    `
        CREATE TABLE ${AUDITED_TABLE_NAME}
        (
            id      INT             IDENTITY    PRIMARY KEY,
            name    NVARCHAR(50)
        );
    `,
    `CREATE TRIGGER trg_audited_insert ON ${AUDITED_TABLE_NAME} AFTER INSERT AS SET NOCOUNT ON;`,
];

export const TENANTS_TABLE_SCHEMA = 'stg';
export const TENANTS_TABLE_NAME = 'tenants';
export const TENANTS_TABLE_DROP = `DROP TABLE IF EXISTS ${TENANTS_TABLE_SCHEMA}.${TENANTS_TABLE_NAME}`;
export const TENANTS_TABLE_CREATES = [
    `
        CREATE TABLE ${TENANTS_TABLE_SCHEMA}.${TENANTS_TABLE_NAME}
        (
            tenant_id   INT             PRIMARY KEY,
            name        NVARCHAR(50)
        );
    `,
];

// Provisions the secondary schema that hosts the tenants table.
export const SETUP_QUERIES = [
    `IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '${TENANTS_TABLE_SCHEMA}') EXEC('CREATE SCHEMA ${TENANTS_TABLE_SCHEMA}')`,
];
