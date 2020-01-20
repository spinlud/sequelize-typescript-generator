export const dataTypesTableName = 'data_types';

export const dataTypesTableDROP = `DROP TABLE IF EXISTS ${dataTypesTableName}`;

export const dataTypesTableCREATE = `
    CREATE TABLE ${dataTypesTableName}
    (
        id                   INT                  auto_increment          primary key,  
        f_bigint             BIGINT               null,
        f_smallint           SMALLINT             null,
        f_mediumint          MEDIUMINT            null,
        f_tinyint            TINYINT              null,
        f_decimal            DECIMAL(7, 3)        null,
        f_float              FLOAT(5, 3)          null,
        f_double             DOUBLE(7, 4)         null,
        f_int                INT                  null,
        f_bit                BIT(1)               null,        
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
        f_enum               ENUM ('A', 'B', 'C') null,
        f_set                SET ('X', 'Y', 'Z')  null,
        f_binary             BINARY               null,
        f_blob               BLOB                 null,
        f_longblob           LONGBLOB             null,
        f_tinyblob           TINYBLOB             null,
        f_geometry           GEOMETRY             null,
        f_geometrycollection GEOMETRYCOLLECTION   null,
        f_point              POINT                null,
        f_multipoint         MULTIPOINT           null,
        f_multipolygon       MULTIPOLYGON         null,
        f_linestring         LINESTRING           null,
        f_multilinestring    MULTILINESTRING      null,
        f_json               JSON                 null
    ) CHARSET = 'latin1'
`;
