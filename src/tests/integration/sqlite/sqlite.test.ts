import { Sequelize } from 'sequelize-typescript';
import { ITestMetadata } from '../ITestMetadata';
import { TestRunner } from '../TestRunner';
import {
    DATA_TYPES_TABLE_NAME,
    DATA_TYPES_TABLE_DROP,
    DATA_TYPES_TABLE_CREATE,
    INDICES_TABLE_NAME,
    INDICES_TABLE_DROP,
    INDICES_TABLE_CREATE,
    INDICES_TABLE_CREATE_INDEX_1,
    INDICES_TABLE_CREATE_INDEX_2,
    INDICES_TABLE_CREATE_INDEX_3,
    INDICES_TABLE_CREATE_INDEX_4,
} from './queries';

export const testMetadata: ITestMetadata = {
    name: 'SQLite',
    dialect: 'sqlite',
    testTables: [
        {
            name: DATA_TYPES_TABLE_NAME,
            createQueries: [ DATA_TYPES_TABLE_CREATE ],
            dropQuery: DATA_TYPES_TABLE_DROP,
        },
        {
            name: INDICES_TABLE_NAME,
            createQueries: [
                INDICES_TABLE_CREATE,
                INDICES_TABLE_CREATE_INDEX_1,
                INDICES_TABLE_CREATE_INDEX_2,
                INDICES_TABLE_CREATE_INDEX_3,
                INDICES_TABLE_CREATE_INDEX_4,
            ],
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
            return column;
        },
        // TODO SQLite does not have static data types thus I'm not sure how to test type mappings
        testValues: [],
    },
};

const testRunner = new TestRunner(testMetadata);
testRunner.run();
