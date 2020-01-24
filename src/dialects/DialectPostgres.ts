import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { createConnection } from '../connection';
import { IConfig } from '../config';
import { ITableMetadata, IColumnMetadata, Dialect } from './Dialect';
import {
    IColumnMetadataMySQL,
    numericPrecisionScale,
    dateTimePrecision,
    caseTransformer,
} from './utils';

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
        smallint: DataType.INTEGER,
        integer: DataType.INTEGER,
        bigint: DataType.BIGINT,
        decimal: DataType.DECIMAL,
        numeric: DataType.DECIMAL,
        real: DataType.REAL,
        double: DataType.DOUBLE,
        smallserial: DataType.INTEGER,
        serial: DataType.INTEGER,
        bigserial: DataType.BIGINT,

        money: DataType.DECIMAL,

        varchar: DataType.STRING,
        varying: DataType.STRING,
        character: DataType.STRING,
        char: DataType.STRING,
        text: DataType.STRING,

        bytea: DataType.BLOB,

        timestamp: DataType.DATE,
        date: DataType.DATEONLY,
        time: DataType.DATE,
        interval: DataType.DATE,

        boolean: DataType.BOOLEAN,

        enum: DataType.ENUM,

        point: DataType.GEOMETRY,
        line: DataType.GEOMETRY,
        lseg: DataType.GEOMETRY,
        box: DataType.GEOMETRY,
        path: DataType.GEOMETRY,
        polygon: DataType.GEOMETRY,
        circle: DataType.GEOMETRY,

        cidr: DataType.CIDR,
        inet: DataType.INET,
        macaddr: DataType.MACADDR,
        macaddr8: DataType.MACADDR,

        bit: DataType.INTEGER,
        'bit varying': DataType.INTEGER,

        // tsvector: ?
        // tsquery: ?

        uuid: DataType.UUID,

        xml: DataType.STRING,

        json: DataType.JSON,
        jsonb: DataType.JSON,
        jsonpath: DataType.JSON,
    };

    public readonly jsDataTypesMap = {
        smallint: 'number',
        integer: 'number',
        bigint: 'bigint',
        decimal: 'number',
        numeric: 'number',
        real: 'number',
        double: 'number',
        smallserial: 'number',
        serial: 'number',
        bigserial: 'bigint',

        money: 'number',

        varchar: 'string',
        varying: 'string',
        character: 'string',
        char: 'string',
        text: 'string',

        bytea: 'Buffer',

        timestamp: 'string',
        date: 'string',
        time: 'string',
        interval: 'string',

        boolean: 'boolean',

        enum: 'string',

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

        bit: 'number',
        'bit varying': 'number',

        // tsvector: ?
        // tsquery: ?

        uuid: 'string',

        xml: 'string',

        json: 'object',
        jsonb: 'object',
        jsonpath: 'object',
    }

    /**
     * Fetch tables metadata from the database
     * @param {IConfig} config
     * @returns {Promise<ITableMetadata[]>}
     */
    async fetchMetadata(config: IConfig): Promise<ITableMetadata[]> {
        return [];
    }

}
