import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { createConnection } from '../connection';
import { IConfig } from '../config';
import { ITableMetadata, IColumnMetadata, Dialect } from './Dialect';
import {
    ITableNameRow,
    IColumnMetadataPostgres,
    numericPrecisionScalePostgres,
    dateTimePrecisionPostgres,
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
        interval: DataType.STRING,
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
        bit: DataType.INTEGER,
        varbit: DataType.INTEGER,
        uuid: DataType.STRING,
        xml: DataType.STRING,
        json: DataType.JSON,
        jsonb: DataType.JSONB,
        jsonpath: DataType.JSON,
    }

    public readonly jsDataTypesMap = {
        int2: 'number',
        int4: 'number',
        int8: 'string',
        numeric: 'string',
        float4: 'string',
        float8: 'string',
        money: 'number',
        varchar: 'string',
        bpchar: 'string',
        text: 'string',
        bytea: 'Buffer',
        timestamp: 'Date',
        timestamptz: 'Date',
        date: 'string',
        time: 'string',
        timetz: 'string',
        interval: 'string',
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
        bit: 'number',
        varbit: 'number',
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
        let connection: Sequelize | undefined;
        const tablesMetadata: ITableMetadata[] = [];

        try {
            connection = createConnection(config.connection);

            await connection.authenticate();

            const tableSchema = config.metadata?.schema ?? 'public';

            const tableNamesQuery = `
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema='${tableSchema}';
            `;

            // Fetch table names (include metadata.tables and exclude metadata.skipTables if provided)
            const tableNames: string[] = (await connection.query(
                tableNamesQuery,
                {
                    type: QueryTypes.SELECT,
                    raw: true,
                }
            ) as ITableNameRow[]).map(row => {
                return row.table_name ?? row.TABLE_NAME!;
            }).filter(tableName => {
                if (config.metadata?.tables?.length) {
                    return config.metadata.tables.includes(tableName.toLowerCase());
                }
                else {
                    return true;
                }
            }).filter(tableName => {
                if (config.metadata?.skipTables?.length) {
                    return !(config.metadata.skipTables.includes(tableName.toLowerCase()));
                }
                else {
                    return true;
                }
            });

            for (const tableName of tableNames) {
                const columnsMetadataQuery = `
                    SELECT
                           c.*,
                           CASE WHEN(seq.sequence_name IS NOT NULL) THEN TRUE ELSE FALSE END AS is_sequence,
                           ix.index_name,
                           ix.index_type,
                           ix.index_is_primary,
                           ix.index_is_unique,
                           ix.index_is_clustered
                    FROM information_schema.columns c
                    LEFT OUTER JOIN ( -- Indices metadata
                        SELECT
                           pc.relname as index_name,
                           am.amname as index_type,
                           a.attname,
                           a.attnum,
                           CASE WHEN (pc.relname IS NOT NULL AND x.indisprimary IS TRUE) THEN 'YES' ELSE NULL END AS index_is_primary,
                           CASE WHEN (pc.relname IS NOT NULL AND x.indisunique IS TRUE) THEN 'YES' ELSE NULL END AS index_is_unique,
                           CASE WHEN (pc.relname IS NOT NULL AND x.indisclustered IS TRUE) THEN 'YES' ELSE NULL END AS index_is_clustered
                        FROM pg_attribute a
                        LEFT OUTER JOIN pg_index x
                            ON a.attnum = ANY (x.indkey) AND a.attrelid = x.indrelid
                        LEFT OUTER JOIN pg_class pc
                            ON x.indexrelid = pc.oid
                        LEFT OUTER JOIN pg_am am
                            ON pc.relam = am.oid
                        WHERE a.attrelid = '${tableSchema}.${tableName}'::regclass AND a.attnum > 0
                    ) ix
                        ON c.ordinal_position = ix.attnum
                    LEFT OUTER JOIN ( -- Sequences (auto increment) metadata
                        SELECT
                           seqclass.relname         AS sequence_name,
                           pn.nspname               AS schema_name,
                           depclass.relname         AS table_name,
                           attrib.attname           AS column_name
                        FROM   pg_class AS seqclass
                        JOIN pg_sequence AS seq
                            ON ( seq.seqrelid = seqclass.relfilenode )
                        JOIN pg_depend AS dep
                            ON ( seq.seqrelid = dep.objid )
                        JOIN pg_class AS depclass
                            ON ( dep.refobjid = depclass.relfilenode )
                        JOIN pg_attribute AS attrib
                            ON ( attrib.attnum = dep.refobjsubid AND attrib.attrelid = dep.refobjid )
                        JOIN pg_namespace pn
                            ON seqclass.relnamespace = pn.oid
                        WHERE pn.nspname = '${tableSchema}' AND depclass.relname = '${tableName}'
                    ) seq
                        ON c.table_schema = seq.schema_name AND c.table_name = seq.table_name AND c.column_name = seq.column_name
                    WHERE c.table_schema = '${tableSchema}' AND c.table_name = '${tableName}'
                    ORDER BY c.ordinal_position;
                `;

                const columnsMetadataPostgres = await connection.query(
                    columnsMetadataQuery,
                    {
                        type: QueryTypes.SELECT,
                        raw: true,
                    }
                ) as IColumnMetadataPostgres[];

                const tableMetadata: ITableMetadata = {
                    name: tableName,
                    modelName: tableName,
                    schema: tableSchema,
                    timestamps: config.metadata?.timestamps ?? false,
                    columns: [],
                    comment: '', // TODO
                };

                // for (const columnMetadataPostgres of columnsMetadataPostgres) {
                for (let i = 0; i < columnsMetadataPostgres.length; ++i) {
                    const columnMetadataPostgres = columnsMetadataPostgres[i];

                    // Data type not recognized
                    if (!this.sequelizeDataTypesMap[columnMetadataPostgres.udt_name]) {
                        console.warn(`[Warning]`,
                            `Unknown data type mapping for '${columnMetadataPostgres.udt_name}'`);
                        console.warn(`[Warning]`,
                            `Skipping column`, columnMetadataPostgres);
                        continue;
                    }

                    // Add new column
                    const columnMetadata: IColumnMetadata = {
                        name: columnMetadataPostgres.column_name,
                        type: columnMetadataPostgres.udt_name,
                        typeExt: columnMetadataPostgres.data_type,
                        dataType: 'DataType.' +
                            this.sequelizeDataTypesMap[columnMetadataPostgres.udt_name].key
                                .split(' ')[0], // avoids 'DOUBLE PRECISION' key to include PRECISION in the mapping
                        allowNull: !!columnMetadataPostgres.is_nullable && !columnMetadataPostgres.index_is_primary,
                        primaryKey: !!columnMetadataPostgres.index_is_primary,
                        autoIncrement: columnMetadataPostgres.is_sequence,
                        unique: !!columnMetadataPostgres.index_is_unique && !columnMetadataPostgres.index_is_primary,
                        indices: [],
                        comment: '', // TODO
                    };

                    // Additional data type information
                    switch (columnMetadataPostgres.udt_name) {
                        case 'decimal':
                        case 'numeric':
                        case 'float':
                        case 'double':
                            columnMetadata.dataType += numericPrecisionScalePostgres(columnMetadataPostgres);
                            break;

                        case 'timestamp':
                        case 'timestampz':
                            columnMetadata.dataType += dateTimePrecisionPostgres(columnMetadataPostgres);
                            break;
                    }

                    let j = i;
                    const ordinalPosition = columnMetadataPostgres.ordinal_position;

                    // Keep adding indices for this column until new column or end of columns is reached
                    while (j < columnsMetadataPostgres.length &&
                        columnsMetadataPostgres[j].ordinal_position === ordinalPosition) {

                        if (columnsMetadataPostgres[j].index_name && !columnsMetadataPostgres[j].index_is_primary) {
                            columnMetadata.indices!.push({
                                name: columnsMetadataPostgres[j].index_name!,
                                using: columnsMetadataPostgres[j].index_type!,
                                unique: !!columnsMetadataPostgres[j].index_is_unique,
                            });
                        }

                        j++;
                    }

                    i = j - 1;


                    tableMetadata.columns.push(columnMetadata);
                }

                tablesMetadata.push(tableMetadata);
            }
        }
        catch(err) {
            console.error(err);
            process.exit(1);
        }
        finally {
            connection && await connection.close();
        }

        // Apply transformation if any
        if (config.metadata?.case) {
            return tablesMetadata.map(tableMetadata => caseTransformer(tableMetadata, config.metadata!.case!));
        }
        else {
            return tablesMetadata;
        }
    }

}
