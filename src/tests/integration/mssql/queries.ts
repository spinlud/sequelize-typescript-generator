export const DATA_TYPES_TABLE_NAME = 'data_types';
export const DATA_TYPES_TABLE_DROP = `DROP TABLE IF EXISTS ${DATA_TYPES_TABLE_NAME}`;
export const DATA_TYPES_TABLE_CREATE = `
    CREATE TABLE ${DATA_TYPES_TABLE_NAME}
    (
        id                 INT identity         constraint data_types_pk        primary key nonclustered,
        f_int              INT,
        f_integer          INTEGER,
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
        f_nchar            NCHAR(1),
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
`;

export const INDICES_TABLE_NAME = 'indices';
export const INDICES_TABLE_DROP = `DROP TABLE IF EXISTS ${INDICES_TABLE_NAME}`;
export const INDICES_TABLE_CREATE = `
    create table indices
    (
        id INT              identity            constraint indices_pk       primary key nonclustered,
        f_unique            INT,
        f_multi_1           VARCHAR(80)         not null,
        f_multi_2           INT,
        f_not_unique        INT
    );

    CREATE UNIQUE INDEX indices_f_unique_uindex
    ON indices (f_unique);
    
    CREATE UNIQUE INDEX indices_f_multi_1_f_multi_2_uindex
    ON indices (f_multi_1, f_multi_2);
    
    CREATE INDEX indices_f_not_unique_index
    ON indices (f_not_unique);
    
    CREATE UNIQUE INDEX indices_f_multi_1_uindex
    ON indices (f_multi_1);
`;
