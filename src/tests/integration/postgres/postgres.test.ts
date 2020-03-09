import { ITestMetadata } from '../ITestMetadata';
import { Sequelize } from 'sequelize-typescript';
import { TestRunner } from '../TestRunner';
import { QueryTypes } from 'sequelize';
import {
    SCHEMA_DROP,
    SCHEMA_CREATE,
    DATA_TYPES_TABLE_NAME,
    DATA_TYPES_TABLE_CREATES,
    DATA_TYPES_TABLE_DROP,
    INDICES_TABLE_NAME,
    INDICES_TABLE_CREATES,
    INDICES_TABLE_DROP,
    AUTHORS_TABLE_NAME,
    AUTHORS_TABLE_DROP,
    AUTHORS_TABLE_CREATES,
    AUTHORS_TABLE_INSERTS,
    BOOKS_TABLE_NAME,
    BOOKS_TABLE_DROP,
    BOOKS_TABLE_CREATES,
    BOOKS_TABLE_INSERTS,
    AUTHORS_BOOKS_TABLE_NAME,
    AUTHORS_BOOKS_TABLE_DROP,
    AUTHORS_BOOKS_TABLE_CREATES,
    AUTHORS_BOOKS_TABLE_INSERTS,
    RACES_TABLE_NAME,
    RACES_TABLE_DROP,
    RACES_TABLE_CREATES,
    RACES_TABLE_INSERTS,
    UNITS_TABLE_NAME,
    UNITS_TABLE_DROP,
    UNITS_TABLE_CREATES,
    UNITS_TABLE_INSERTS,
    PERSON_TABLE_NAME,
    PERSON_TABLE_DROP,
    PERSON_TABLE_CREATES,
    PERSON_TABLE_INSERTS,
    PASSPORT_TABLE_NAME,
    PASSPORT_TABLE_DROP,
    PASSPORT_TABLE_CREATES,
    PASSPORT_TABLE_INSERTS,
} from "./queries";

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
            createQueries: DATA_TYPES_TABLE_CREATES,
            dropQuery: DATA_TYPES_TABLE_DROP,
        },
        {
            name: INDICES_TABLE_NAME,
            createQueries: INDICES_TABLE_CREATES,
            dropQuery: INDICES_TABLE_DROP,
        },
        {
            name: AUTHORS_TABLE_NAME,
            createQueries: AUTHORS_TABLE_CREATES,
            dropQuery: AUTHORS_TABLE_DROP,
            insertQueries: AUTHORS_TABLE_INSERTS,
        },
        {
            name: BOOKS_TABLE_NAME,
            createQueries: BOOKS_TABLE_CREATES,
            dropQuery: BOOKS_TABLE_DROP,
            insertQueries: BOOKS_TABLE_INSERTS,
        },
        {
            name: AUTHORS_BOOKS_TABLE_NAME,
            createQueries: AUTHORS_BOOKS_TABLE_CREATES,
            dropQuery: AUTHORS_BOOKS_TABLE_DROP,
            insertQueries: AUTHORS_BOOKS_TABLE_INSERTS,
        },
        {
            name: RACES_TABLE_NAME,
            createQueries: RACES_TABLE_CREATES,
            dropQuery: RACES_TABLE_DROP,
            insertQueries: RACES_TABLE_INSERTS,
        },
        {
            name: UNITS_TABLE_NAME,
            createQueries: UNITS_TABLE_CREATES,
            dropQuery: UNITS_TABLE_DROP,
            insertQueries: UNITS_TABLE_INSERTS,
        },
        {
            name: PERSON_TABLE_NAME,
            createQueries: PERSON_TABLE_CREATES,
            dropQuery: PERSON_TABLE_DROP,
            insertQueries: PERSON_TABLE_INSERTS,
        },
        {
            name: PASSPORT_TABLE_NAME,
            createQueries: PASSPORT_TABLE_CREATES,
            dropQuery: PASSPORT_TABLE_DROP,
            insertQueries: PASSPORT_TABLE_INSERTS,
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
            ['character', 'AB'],
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
    associations: {
        leftTableOneToOne: PERSON_TABLE_NAME,
        rightTableOneToOne: PASSPORT_TABLE_NAME,
        leftTableOneToMany: RACES_TABLE_NAME,
        rightTableOneToMany: UNITS_TABLE_NAME,
        leftTableManyToMany: AUTHORS_TABLE_NAME,
        rightTableManyToMany: BOOKS_TABLE_NAME,
    },
};

const testRunner = new TestRunner(testMetadata);
testRunner.run();
