import { ITestMetadata } from '../ITestMetadata';
import { Sequelize } from 'sequelize-typescript';
import { TestRunner } from '../TestRunner';
import {
    SCHEMA_DROP,
    SCHEMA_CREATE,
    DATA_TYPES_TABLE_NAME,
    DATA_TYPES_TABLE_CREATE,
    DATA_TYPES_TABLE_DROP,
    INDICES_TABLE_NAME,
    INDICES_TABLE_CREATE,
    INDICES_TABLE_DROP,
} from "./queries";
import {QueryTypes} from "sequelize";

interface INativeType {
    udt_name: string;
    UDT_NAME: string;
}

const testMetadata: ITestMetadata = {
    name: 'Postgres',
    dialect: 'postgres',
    schema: {
        name: process.env.TEST_DB_SCHEMA ?? 'public',
        createQuery: SCHEMA_CREATE,
        dropQuery: SCHEMA_DROP,
    },
    testTables: [
        {
            name: DATA_TYPES_TABLE_NAME,
            createQueries: [ DATA_TYPES_TABLE_CREATE ],
            dropQuery: DATA_TYPES_TABLE_DROP,
        },
        {
            name: INDICES_TABLE_NAME,
            createQueries: [ INDICES_TABLE_CREATE ],
            dropQuery: INDICES_TABLE_DROP,
        },
    ],
    filterTables: [ DATA_TYPES_TABLE_NAME ],
    filterSkipTables: [ INDICES_TABLE_NAME ],
    dataTypes: {
        dataTypesTable: DATA_TYPES_TABLE_NAME,
        async getColumnNativeDataType(
            connection: Sequelize,
            schema: string,
            table: string,
            column: string): Promise<string>
        {
            const query = `
                SELECT udt_name
                FROM information_schema.columns
                WHERE table_schema='${schema}' AND table_name='${table}' AND column_name='${column}';
            `;

            const res = await connection.query(query, {
                type: QueryTypes.SELECT,
                raw: true,
            }) as INativeType[];

            return res[0].udt_name ?? res[0].UDT_NAME;
        },
        testValues: [
            ['smallint', 32767],
            ['integer', 2147483647],
            ['bigint', '100000000000000000'],
            ['decimal', '99.999'],
            ['numeric', '66.78'],
            ['real', 66.66],
            ['double', 11.2345],
            ['money', '$100,000.00'],
            ['varchar', 'Hello world'],
            ['char', 'A'],
            ['character', 'A'],
            ['text', 'xYz'],
            ['cidr', '10.0.0.0/16'],
            ['inet', '192.168.100.128/25'],
            ['macaddr', '08:00:2b:01:02:03'],
            ['macaddr8', '08:00:2b:01:02:03:04:05'],
            ['bit', '1'],
            ['varbit', '101'],
            ['uuid', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
            ['xml', `<foo>bar</foo>`],
            ['bytea', Buffer.from('A')],
            ['timestamp', new Date()],
            ['timestamptz', new Date()],
            ['date', '2020-01-01'],
            ['time', '23:59:59'],
            ['timetz', '23:59:59+00'],
            ['boolean', true],
            // ['point', ''], // need PostGIS extension installed on Postgres
            // ['line', ''], // need PostGIS extension installed on Postgres
            // ['lseg', ''], // need PostGIS extension installed on Postgres
            // ['box', ''], // need PostGIS extension installed on Postgres
            // ['path', ''], // need PostGIS extension installed on Postgres
            // ['polygon', ''], // need PostGIS extension installed on Postgres
            // ['circle', ''], // need PostGIS extension installed on Postgres
            ['json', JSON.parse('{"key1": "value1", "key2": "value2"}')],
            ['jsonb', JSON.parse('{"key1": "value1", "key2": "value2"}')],
        ],
    },
};

const testRunner = new TestRunner(testMetadata);
testRunner.run();
