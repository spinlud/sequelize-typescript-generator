import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { IConfig } from '../config';
import { IColumnMetadata, IIndexMetadata, Dialect } from './Dialect';
import { warnUnknownMappingForDataType } from './utils';

interface ITableNameRow {
    table_name?: string;
    TABLE_NAME?: string;
}

interface IColumnMetadataPostgres {
    is_sequence: boolean;
    is_primary: boolean;
    table_catalog: string;
    table_schema: string;
    table_name: string;
    column_name: string;
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
}

interface IIndexMetadataPostgres {
    index_name: string;
    index_type: string;
    is_primary: boolean;
    is_unique: boolean;
    is_clustered: boolean;
    column_name: string;
    ordinal_position: string;
}

/**
 * Compute precision/scale signature for numeric types: FLOAT(4, 2), DECIMAL(5, 2) etc
 * @param {IColumnMetadataPostgres} columnMetadataPostgres
 * @returns {string} '(5, 2)'
 */
const numericPrecisionScalePostgres = (columnMetadataPostgres: IColumnMetadataPostgres): string => {
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
const dateTimePrecisionPostgres = (columnMetadataPostgres: IColumnMetadataPostgres): string => {
    if (columnMetadataPostgres.datetime_precision) {
        return `(${columnMetadataPostgres.datetime_precision})`;
    }
    else {
        return '';
    }
};

/**
 * Dialect for Postgres
 * @class DialectPostgres
 */
export class DialectPostgres extends Dialect {

    // REFERENCE: https://www.postgresql.org/docs/12/datatype-bit.html

    // smallint	2 bytes	small-range integer	-32768 to +32767
    // integer	4 bytes	typical choice for integer	-2147483648 to +2147483647
    // bigint	8 bytes	large-range integer	-9223372036854775808 to +9223372036854775807
    // decimal	variable	user-specified precision, exact	up to 131072 digits before the decimal point; up to 16383 digits after the decimal point
    // numeric	variable	user-specified precision, exact	up to 131072 digits before the decimal point; up to 16383 digits after the decimal point
    // real	4 bytes	variable-precision, inexact	6 decimal digits precision
    // double precision	8 bytes	variable-precision, inexact	15 decimal digits precision
    // smallserial	2 bytes	small autoincrementing integer	1 to 32767
    // serial	4 bytes	autoincrementing integer	1 to 2147483647
    // bigserial	8 bytes	large autoincrementing integer	1 to 9223372036854775807

    // character varying(n), varchar(n)	variable-length with limit
    // character(n), char(n)	fixed-length, blank padded
    // text	variable unlimited length

    // bytea	1 or 4 bytes plus the actual binary string	variable-length binary string

    // timestamp [ (p) ] [ without time zone ]	8 bytes	both date and time (no time zone)	4713 BC	294276 AD	1 microsecond
    // timestamp [ (p) ] with time zone	8 bytes	both date and time, with time zone	4713 BC	294276 AD	1 microsecond
    // date	4 bytes	date (no time of day)	4713 BC	5874897 AD	1 day
    // time [ (p) ] [ without time zone ]	8 bytes	time of day (no date)	00:00:00	24:00:00	1 microsecond
    // time [ (p) ] with time zone	12 bytes	time of day (no date), with time zone	00:00:00+1459	24:00:00-1459	1 microsecond
    // interval [ fields ] [ (p) ]	16 bytes	time interval	-178000000 years	178000000 years	1 microsecond

    // boolean	1 byte	state of true or false

    // point	16 bytes	Point on a plane	(x,y)
    // line	32 bytes	Infinite line	{A,B,C}
    // lseg	32 bytes	Finite line segment	((x1,y1),(x2,y2))
    // box	32 bytes	Rectangular box	((x1,y1),(x2,y2))
    // path	16+16n bytes	Closed path (similar to polygon)	((x1,y1),...)
    // path	16+16n bytes	Open path	[(x1,y1),...]
    // polygon	40+16n bytes	Polygon (similar to closed path)	((x1,y1),...)
    // circle	24 bytes	Circle	<(x,y),r> (center point and radius)

    // cidr	7 or 19 bytes	IPv4 and IPv6 networks
    // inet	7 or 19 bytes	IPv4 and IPv6 hosts and networks
    // macaddr	6 bytes	MAC addresses
    // macaddr8	8 bytes	MAC addresses (EUI-64 format)

    public readonly sequelizeDataTypesMap: { [key: string]: AbstractDataTypeConstructor } = {
        int2: DataType.INTEGER,
        int4: DataType.INTEGER,
        int8: DataType.BIGINT,
        numeric: DataType.DECIMAL,
        float4: DataType.FLOAT,
        float8: DataType.DOUBLE,
        money: DataType.NUMBER,
        varchar: DataType.STRING,
        bpchar: DataType.STRING,
        text: DataType.STRING,
        bytea: DataType.BLOB,
        timestamp: DataType.DATE,
        timestamptz: DataType.DATE,
        date: DataType.STRING,
        time: DataType.STRING,
        timetz: DataType.STRING,
        // interval: DataType.STRING,
        bool: DataType.BOOLEAN,
        point: DataType.GEOMETRY,
        line: DataType.GEOMETRY,
        lseg: DataType.GEOMETRY,
        box: DataType.GEOMETRY,
        path: DataType.GEOMETRY,
        polygon: DataType.GEOMETRY,
        circle: DataType.GEOMETRY,
        cidr: DataType.STRING,
        inet: DataType.STRING,
        macaddr: DataType.STRING,
        macaddr8: DataType.STRING,
        bit: DataType.STRING,
        varbit: DataType.STRING,
        uuid: DataType.STRING,
        xml: DataType.STRING,
        json: DataType.JSON,
        jsonb: DataType.JSONB,
        jsonpath: DataType.JSON,
    }

    public readonly jsDataTypesMap: { [key: string]: string } = {
        int2: 'number',
        int4: 'number',
        int8: 'string',
        numeric: 'string',
        float4: 'number',
        float8: 'number',
        money: 'string',
        varchar: 'string',
        bpchar: 'string',
        text: 'string',
        bytea: 'Uint8Array',
        timestamp: 'Date',
        timestamptz: 'Date',
        date: 'string',
        time: 'string',
        timetz: 'string',
        interval: 'object',
        bool: 'boolean',
        point: 'object',
        line: 'object',
        lseg: 'object',
        box: 'object',
        path: 'object',
        polygon: 'object',
        circle: 'object',
        cidr: 'string',
        inet: 'string',
        macaddr: 'string',
        macaddr8: 'string',
        bit: 'string',
        varbit: 'string',
        uuid: 'string',
        xml: 'string',
        json: 'object',
        jsonb: 'object',
        jsonpath: 'object',
    }

    /**
     * Fetch table names for the provided database/schema
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @returns {Promise<string[]>}
     */
    protected async fetchTableNames(
        connection: Sequelize,
        config: IConfig
    ): Promise<string[]> {
        const query = `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema='${config.metadata!.schema}';
        `;

        const tableNames: string[] = (await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as ITableNameRow[]).map(row => row.table_name ?? row.TABLE_NAME!);

        return tableNames;
    }

    /**
     * Fetch columns metadata for the provided schema and table
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {string} table
     * @returns {Promise<IColumnMetadata[]>}
     */
    protected async fetchColumnsMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string
    ): Promise<IColumnMetadata[]> {
        const columnsMetadata: IColumnMetadata[] = [];

        const query = `
            SELECT
                CASE WHEN (seq.sequence_name IS NOT NULL) THEN TRUE ELSE FALSE END AS is_sequence,
                EXISTS( -- primary key
                   SELECT
                    x.indisprimary
                   FROM pg_attribute a
                    LEFT OUTER JOIN pg_index x
                        ON a.attnum = ANY (x.indkey) AND a.attrelid = x.indrelid
                    WHERE a.attrelid = '${config.metadata!.schema}.${table}'::regclass AND a.attnum > 0
                        AND c.ordinal_position = a.attnum AND x.indisprimary IS TRUE
                ) AS is_primary,
                c.*
            FROM information_schema.columns c
            LEFT OUTER JOIN ( -- Sequences (auto increment) metadata
                SELECT seqclass.relname AS sequence_name,
                       pn.nspname       AS schema_name,
                       depclass.relname AS table_name,
                       attrib.attname   AS column_name
                FROM pg_class AS seqclass
                         JOIN pg_sequence AS seq
                              ON (seq.seqrelid = seqclass.relfilenode)
                         JOIN pg_depend AS dep
                              ON (seq.seqrelid = dep.objid)
                         JOIN pg_class AS depclass
                              ON (dep.refobjid = depclass.relfilenode)
                         JOIN pg_attribute AS attrib
                              ON (attrib.attnum = dep.refobjsubid AND attrib.attrelid = dep.refobjid)
                         JOIN pg_namespace pn
                              ON seqclass.relnamespace = pn.oid
                WHERE pn.nspname = '${config.metadata!.schema}' AND depclass.relname = '${table}'
            ) seq
                 ON c.table_schema = seq.schema_name AND c.table_name = seq.table_name AND
                    c.column_name = seq.column_name
            WHERE c.table_schema = '${config.metadata!.schema}' AND c.table_name = '${table}'
            ORDER BY c.ordinal_position;
        `;

        const columns = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IColumnMetadataPostgres[];

        for (const column of columns) {
            // Unknown data type
            if (!this.sequelizeDataTypesMap[column.udt_name]) {
                warnUnknownMappingForDataType(column.udt_name);
            }

            const columnMetadata: IColumnMetadata = {
                name: column.column_name,
                type: column.udt_name,
                typeExt: column.data_type,
                ...this.sequelizeDataTypesMap[column.udt_name] && {
                    dataType: 'DataType.' +
                        this.sequelizeDataTypesMap[column.udt_name].key
                            .split(' ')[0], // avoids 'DOUBLE PRECISION' key to include PRECISION in the mapping
                },
                allowNull: !!column.is_nullable && !column.is_primary,
                primaryKey: column.is_primary,
                autoIncrement: column.is_sequence,
                indices: [],
                comment: '', // TODO
            };

            // Additional data type information
            switch (column.udt_name) {
                case 'decimal':
                case 'numeric':
                case 'float':
                case 'double':
                    columnMetadata.dataType += numericPrecisionScalePostgres(column);
                    break;

                case 'timestamp':
                case 'timestampz':
                    columnMetadata.dataType += dateTimePrecisionPostgres(column);
                    break;
            }

            columnsMetadata.push(columnMetadata);
        }

        return columnsMetadata;
    }

    /**
     * Fetch index metadata for the provided table and column
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {string} table
     * @param {string} column
     * @returns {Promise<IIndexMetadata[]>}
     */
    protected async fetchColumnIndexMetadata(
        connection: Sequelize,
        config: IConfig,
        table: string,
        column: string
    ): Promise<IIndexMetadata[]> {
        const indicesMetadata: IIndexMetadata[] = [];

        const query = `
            SELECT pc.relname       AS index_name,
                   am.amname        AS index_type,
                   a.attname        AS column_name,
                   a.attnum         AS ordinal_position,
                   x.indisprimary   AS is_primary,
                   x.indisunique    AS is_unique,
                   x.indisclustered AS is_clustered
            FROM pg_attribute a
            INNER JOIN pg_index x
                ON a.attnum = ANY (x.indkey) AND a.attrelid = x.indrelid
            INNER JOIN pg_class pc
                ON x.indexrelid = pc.oid
            INNER JOIN pg_am am
                ON pc.relam = am.oid
            WHERE a.attrelid = '${config.metadata!.schema}.${table}'::regclass AND a.attnum > 0 
                AND a.attname = '${column}';
        `;

        const indices = await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as IIndexMetadataPostgres[];

        for (const index of indices) {
            indicesMetadata.push({
                name: index.index_name,
                using: index.index_type,
                unique: index.is_unique,
            });
        }

        return indicesMetadata;
    }
}
