import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { ITestMetadata } from '../ITestMetadata';
import { TestRunner } from '../TestRunner';
import * as geometries from './geometries';
import {
    DATA_TYPES_TABLE_NAME,
    DATA_TYPES_TABLE_DROP,
    DATA_TYPES_TABLE_CREATE,
    INDICES_TABLE_NAME,
    INDICES_TABLE_DROP,
    INDICES_TABLE_CREATE,
    INDICES_TABLE_CREATE_INDEX,
    AUTHORS_TABLE_NAME,
    AUTHORS_TABLE_DROP,
    AUTHORS_TABLE_CREATE,
    BOOKS_TABLE_NAME,
    BOOKS_TABLE_DROP,
    BOOKS_TABLE_CREATE,
    AUTHORS_BOOKS_TABLE_NAME,
    AUTHORS_BOOKS_TABLE_DROP,
    AUTHORS_BOOKS_TABLE_CREATE,
} from './queries';

interface INativeType {
    DATA_TYPE: string;
    data_type: string;
}

const testMetadata: ITestMetadata = {
    name: 'MySQL',
    dialect: 'mysql',
    testTables: [
        {
            name: DATA_TYPES_TABLE_NAME,
            createQueries: [ DATA_TYPES_TABLE_CREATE ],
            dropQuery: DATA_TYPES_TABLE_DROP,
        },
        {
            name: INDICES_TABLE_NAME,
            createQueries: [ INDICES_TABLE_CREATE, INDICES_TABLE_CREATE_INDEX ],
            dropQuery: INDICES_TABLE_DROP,
        },
        {
            name: AUTHORS_TABLE_NAME,
            createQueries: [ AUTHORS_TABLE_CREATE ],
            dropQuery: AUTHORS_TABLE_DROP,
        },
        {
            name: BOOKS_TABLE_NAME,
            createQueries: [ BOOKS_TABLE_CREATE ],
            dropQuery: BOOKS_TABLE_DROP,
        },
        {
            name: AUTHORS_BOOKS_TABLE_NAME,
            createQueries: [ AUTHORS_BOOKS_TABLE_CREATE ],
            dropQuery: AUTHORS_BOOKS_TABLE_DROP,
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
                SELECT DATA_TYPE
                FROM information_schema.columns
                WHERE table_schema='${schema}' AND table_name='${table}' AND column_name='${column}';
            `;

            const res = await connection.query(query, {
                type: QueryTypes.SELECT,
                raw: true,
            }) as INativeType[];

            return res[0].DATA_TYPE ?? res[0].data_type;
        },
        testValues: [
            ['bigint', 100000000000000000],
            ['smallint', 32767],
            ['mediumint', 8388607],
            ['tinyint', 127],
            ['decimal', '99.999'],
            ['float', 66.78],
            ['double', 11.2345],
            ['int', 2147483647],
            ['varchar', 'Hello world'],
            ['char', 'a'],
            ['tinytext', 'xyz'],
            ['mediumtext', 'Voodoo Lady'],
            ['longtext', 'Supercalifragilisticexpialidocious'],
            ['text', 'Access denied'],
            ['date', '2020-01-01'],
            ['time', '23:59:59'],
            ['datetime', new Date()],
            ['timestamp', new Date()],
            ['year', new Date().getFullYear()],
            ['enum', 'BB'],
            ['set', 'X'],
            ['bit', 127],
            ['binary', Buffer.from('A')],
            ['blob', Buffer.from('Not authorized')],
            ['tinyblob', Buffer.from('xyz')],
            ['mediumblob', Buffer.from('Voodoo Lady')],
            ['longblob', Buffer.from('Supercalifragilisticexpialidocious')],
            ['point', geometries.Point],
            ['multipoint', geometries.MultiPoint],
            ['linestring', geometries.LineString],
            ['multilinestring', geometries.MultiLineString],
            ['polygon', geometries.Polygon],
            ['multipolygon', geometries.MultiPolygon],
            ['geometry', geometries.Geometry],
            // ['geometrycollection', geometries.GeometryCollection],
            ['json', JSON.parse('{"key1": "value1", "key2": "value2"}')],
        ]
    },
};

const testRunner = new TestRunner(testMetadata);
testRunner.run();
