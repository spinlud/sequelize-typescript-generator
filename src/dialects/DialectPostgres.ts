import { QueryTypes, AbstractDataTypeConstructor } from 'sequelize';
import { Sequelize, DataTypes } from 'sequelize';
import { IConfig } from '../config/index.js';
import { IColumnMetadata, IIndexMetadata, IForeignKeyConstraintMetadata, Dialect, ITable } from './Dialect.js';
import { warnUnknownMappingForDataType } from './utils.js';
import {
    buildSequelizeDataType,
    renderDataTypeExpression,
    DATA_TYPE_NAMESPACES,
    DataTypeArgument,
} from './dataTypes.js';
import { groupForeignKeyRows, IForeignKeyColumnRow } from './foreignKeys.js';

interface ITableRow {
    table_name: string;
    table_comment?: string;
}

interface IForeignKeyRowPostgres {
    constraint_name: string;
    source_table: string;
    source_column: string;
    target_schema: string;
    target_table: string;
    target_column: string;
    ordinal_position: number;
    on_delete: string; // Single-letter pg_constraint code (a/r/c/n/d)
    on_update: string; // Single-letter pg_constraint code (a/r/c/n/d)
    is_source_column_unique: boolean;
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
    int2: DataTypes.INTEGER,
    int4: DataTypes.INTEGER,
    int8: DataTypes.BIGINT,
    numeric: DataTypes.DECIMAL,
    float4: DataTypes.FLOAT,
    float8: DataTypes.DOUBLE,
    money: DataTypes.NUMBER,
    varchar: DataTypes.STRING,
    bpchar: DataTypes.STRING,
    text: DataTypes.STRING,
    bytea: DataTypes.BLOB,
    timestamp: DataTypes.DATE,
    timestamptz: DataTypes.DATE,
    date: DataTypes.STRING,
    time: DataTypes.STRING,
    timetz: DataTypes.STRING,
    // interval: DataTypes.STRING,
    bool: DataTypes.BOOLEAN,
    point: DataTypes.GEOMETRY,
    line: DataTypes.GEOMETRY,
    lseg: DataTypes.GEOMETRY,
    box: DataTypes.GEOMETRY,
    path: DataTypes.GEOMETRY,
    polygon: DataTypes.GEOMETRY,
    circle: DataTypes.GEOMETRY,
    geometry: DataTypes.GEOMETRY,
    cidr: DataTypes.STRING,
    inet: DataTypes.STRING,
    macaddr: DataTypes.STRING,
    macaddr8: DataTypes.STRING,
    bit: DataTypes.STRING,
    varbit: DataTypes.STRING,
    uuid: DataTypes.UUID,
    xml: DataTypes.STRING,
    json: DataTypes.JSON,
    jsonb: DataTypes.JSONB,
    jsonpath: DataTypes.JSON,
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
     * @returns {string}
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
            WHERE t.table_schema='${config.connection.schema}' AND pc.relkind = 'r';
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
                    WHERE a.attrelid = '${config.connection.schema}.\"${table}\"'::regclass AND a.attnum > 0
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
                WHERE pn.nspname = '${config.connection.schema}' AND depclass.relname = '${table}'
            ) seq
                 ON c.table_schema = seq.schema_name AND c.table_name = seq.table_name AND
                    c.column_name = seq.column_name
            WHERE c.table_schema = '${config.connection.schema}' AND c.table_name = '${table}'
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

            const sequelizeConstructor = this.mapDbTypeToSequelize(column.udt_name);

            // Data type arguments (precision or length)
            let dataTypeArgs: Array<DataTypeArgument | null | undefined> = [];

            switch (column.udt_name) {
                case 'decimal':
                case 'numeric':
                case 'float':
                case 'double':
                    dataTypeArgs = [column.numeric_precision, column.numeric_scale];
                    break;

                case 'timestamp':
                case 'timestampz':
                    dataTypeArgs = [column.datetime_precision];
                    break;

                case 'bpchar':
                case 'varchar':
                    dataTypeArgs = [column.character_maximum_length];
                    break;
            }

            const sequelizeType = sequelizeConstructor
                ? buildSequelizeDataType(sequelizeConstructor, dataTypeArgs)
                : undefined;

            const columnMetadata: IColumnMetadata = {
                name: column.column_name,
                originName: column.column_name,
                type: column.udt_name,
                typeExt: column.data_type,
                ...sequelizeType && {
                    sequelizeType,
                    dataType: renderDataTypeExpression(sequelizeType, DATA_TYPE_NAMESPACES.decorators),
                },
                allowNull: column.is_nullable === 'YES' && !column.is_primary,
                primaryKey: column.is_primary,
                autoIncrement: column.is_sequence,
                indices: [],
                comment: column.description ?? undefined,
            };
            if (column.column_default) {
                columnMetadata.defaultValue = `Sequelize.literal("${column.column_default.replace(/\"/g, '\\\"')}")`;
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
            WHERE a.attrelid = '${config.connection.schema}.\"${table}\"'::regclass AND a.attnum > 0 
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

    /**
     * Fetch foreign key constraints for the provided table. Constraints are read from
     * pg_constraint, expanded to one row per column position with unnest ... WITH
     * ORDINALITY, and a source column is flagged unique when it is covered by a
     * single-column non-partial unique index.
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {ITable} table
     * @returns {Promise<IForeignKeyConstraintMetadata[]>}
     */
    protected async fetchForeignKeysMetadata(
        connection: Sequelize,
        config: IConfig,
        table: ITable
    ): Promise<IForeignKeyConstraintMetadata[]> {
        const foreignKeyRows = await connection.query<IForeignKeyRowPostgres>(
            `
                SELECT
                    con.conname     AS constraint_name,
                    src.relname     AS source_table,
                    src_att.attname AS source_column,
                    tgt_ns.nspname  AS target_schema,
                    tgt.relname     AS target_table,
                    tgt_att.attname AS target_column,
                    cols.ordinal_position AS ordinal_position,
                    con.confdeltype AS on_delete,
                    con.confupdtype AS on_update,
                    EXISTS (
                        SELECT 1
                        FROM pg_index x
                        WHERE x.indrelid = con.conrelid
                            AND x.indisunique
                            AND x.indpred IS NULL
                            AND x.indnatts = 1
                            AND x.indkey[0] = src_att.attnum
                    ) AS is_source_column_unique
                FROM pg_constraint con
                JOIN pg_class src ON src.oid = con.conrelid
                JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
                JOIN pg_class tgt ON tgt.oid = con.confrelid
                JOIN pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
                CROSS JOIN LATERAL unnest(con.conkey, con.confkey)
                    WITH ORDINALITY AS cols(src_attnum, tgt_attnum, ordinal_position)
                JOIN pg_attribute src_att
                    ON src_att.attrelid = con.conrelid AND src_att.attnum = cols.src_attnum
                JOIN pg_attribute tgt_att
                    ON tgt_att.attrelid = con.confrelid AND tgt_att.attnum = cols.tgt_attnum
                WHERE con.contype = 'f'
                    AND src_ns.nspname = '${config.connection.schema}'
                    AND src.relname = '${table.name}'
                ORDER BY con.conname, cols.ordinal_position;
            `,
            {
                type: QueryTypes.SELECT,
                raw: true,
            }
        );

        const rows: IForeignKeyColumnRow[] = foreignKeyRows.map(row => ({
            constraintName: row.constraint_name,
            sourceTable: row.source_table,
            sourceColumn: row.source_column,
            targetSchema: row.target_schema,
            targetTable: row.target_table,
            targetColumn: row.target_column,
            ordinalPosition: row.ordinal_position,
            onDelete: row.on_delete,
            onUpdate: row.on_update,
            isSourceColumnUnique: row.is_source_column_unique,
        }));

        return groupForeignKeyRows(rows);
    }
}
