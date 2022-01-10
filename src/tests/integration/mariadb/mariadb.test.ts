import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { ITestMetadata } from '../ITestMetadata';
import { TestRunner } from '../TestRunner';
import * as geometries from './geometries';
import {
    DATA_TYPES_TABLE_NAME,
    DATA_TYPES_TABLE_DROP,
    DATA_TYPES_TABLE_CREATES,
    INDICES_TABLE_NAME,
    INDICES_TABLE_DROP,
    INDICES_TABLE_CREATES,
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
    AUTHORS_VIEW_CREATES,
    AUTHORS_VIEW_DROP,
    AUTHORS_VIEW_NAME,
} from './queries';

interface INativeType {
    DATA_TYPE: string;
    data_type: string;
}

export const testMetadata: ITestMetadata = {
    name: 'MariaDB',
    dialect: 'mariadb',
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
    testViews: [
        {
            name: AUTHORS_VIEW_NAME,
            createQueries: AUTHORS_VIEW_CREATES,
            dropQuery: AUTHORS_VIEW_DROP,
        }
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
            ['json', JSON.stringify({key1: 'value1', key2: 'value2'})],
        ]
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
