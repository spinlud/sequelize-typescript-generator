import { Sequelize } from 'sequelize-typescript';
import { ITestMetadata } from '../ITestMetadata';
import { TestRunner } from '../TestRunner';
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

} from './queries';

export const testMetadata: ITestMetadata = {
    name: 'SQLite',
    dialect: 'sqlite',
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
            return column;
        },
        // TODO SQLite does not have static data types thus I'm not sure how to test type mappings
        testValues: [
            ['varchar', 'Hello world'],
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
