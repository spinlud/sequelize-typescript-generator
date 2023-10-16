import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataType } from 'sequelize-typescript';
import { IConfig } from '../config';
import { IColumnMetadata, IIndexMetadata, Dialect, ITable } from './Dialect';
import { generatePrecisionSignature, warnUnknownMappingForDataType } from './utils';

interface ITableRow {
    table_name: string;
    table_comment?: string;
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
    description: string | null;
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

const sequelizeDataTypesMap: { [key: string]: AbstractDataTypeConstructor } = {
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
    geometry: DataType.GEOMETRY,
    cidr: DataType.STRING,
    inet: DataType.STRING,
    macaddr: DataType.STRING,
    macaddr8: DataType.STRING,
    bit: DataType.STRING,
    varbit: DataType.STRING,
    uuid: DataType.UUID,
    xml: DataType.STRING,
    json: DataType.JSON,
    jsonb: DataType.JSONB,
    jsonpath: DataType.JSON,
}

const jsDataTypesMap: { [key: string]: string } = {
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
    geometry: 'object',
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
 * Dialect for Postgres
 * @class DialectPostgres
 */
export class DialectPostgres extends Dialect {

    constructor() {
        super('postgres');
    }

    /**
     * Map database data type to sequelize data type
     * @param {string} dbType
     * @returns {string}
     */
    public mapDbTypeToSequelize(dbType: string): AbstractDataTypeConstructor {
        return sequelizeDataTypesMap[dbType];
    }

    /**
     * Map database data type to javascript data type
     * @param {string} dbType
     * @returns {string
     */
    public mapDbTypeToJs(dbType: string): string {
        return jsDataTypesMap[dbType];
    }

    /**
     * Map database default values to Sequelize type (e.g. uuid() => DataType.UUIDV4).
     * @param {string} v
     * @returns {string}
     */
    public mapDefaultValueToSequelize(v: string): string {
        return v;
    }

    /**
     * Fetch table names for the provided database/schema
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @returns {Promise<ITable[]>}
     */
    protected async fetchTables(
        connection: Sequelize,
        config: IConfig
    ): Promise<ITable[]> {
        const query = `
            SELECT 
                t.table_name                AS table_name,
                obj_description(pc.oid)     AS table_comment
            FROM information_schema.tables t
            JOIN pg_class pc
                ON t.table_name = pc.relname
            WHERE t.table_schema='${config.metadata!.schema}' AND pc.relkind = 'r';
        `;

        const tables: ITable[] = (await connection.query(
            query,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        ) as ITableRow[]).map(({ table_name, table_comment }) => {
            const t: ITable = {
                name: table_name,
                comment: table_comment ?? undefined,
            };

            return t;
        });

        return tables;
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
                    WHERE a.attrelid = '${config.metadata!.schema}.\"${table}\"'::regclass AND a.attnum > 0
                        AND c.ordinal_position = a.attnum AND x.indisprimary IS TRUE
                ) AS is_primary,
                c.*,
                pgd.description
            FROM information_schema.columns c
            INNER JOIN pg_catalog.pg_statio_all_tables as st
                ON c.table_schema = st.schemaname AND c.table_name = st.relname
            LEFT OUTER JOIN pg_catalog.pg_description pgd
                ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
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
            if (!this.mapDbTypeToSequelize(column.udt_name)) {
                warnUnknownMappingForDataType(column.udt_name);
            }

            const columnMetadata: IColumnMetadata = {
                name: column.column_name,
                originName: column.column_name,
                type: column.udt_name,
                typeExt: column.data_type,
                ...this.mapDbTypeToSequelize(column.udt_name) && {
                    dataType: 'DataType.' +
                        this.mapDbTypeToSequelize(column.udt_name).key
                            .split(' ')[0], // avoids 'DOUBLE PRECISION' key to include PRECISION in the mapping
                },
                allowNull: !!column.is_nullable && !column.is_primary,
                primaryKey: column.is_primary,
                autoIncrement: column.is_sequence,
                indices: [],
                comment: column.description ?? undefined,
            };
            if (column.column_default) {
                columnMetadata.defaultValue = `Sequelize.literal("${column.column_default.replace(/\"/g, '\\\"')}")`;
            }

            // Additional data type information
            switch (column.udt_name) {
                case 'decimal':
                case 'numeric':
                case 'float':
                case 'double':
                    columnMetadata.dataType +=
                        generatePrecisionSignature(column.numeric_precision, column.numeric_scale);
                    break;

                case 'timestamp':
                case 'timestampz':
                    columnMetadata.dataType += generatePrecisionSignature(column.datetime_precision);
                    break;

                case 'bpchar':
                case 'varchar':
                    columnMetadata.dataType += generatePrecisionSignature(column.character_maximum_length);
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
            WHERE a.attrelid = '${config.metadata!.schema}.\"${table}\"'::regclass AND a.attnum > 0 
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
