import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { ITestMetadata } from '../ITestMetadata';
import { TestRunner } from '../TestRunner';
import {
    DATA_TYPES_TABLE_NAME,
    DATA_TYPES_TABLE_DROP,
    DATA_TYPES_TABLE_CREATE,
    INDICES_TABLE_NAME,
    INDICES_TABLE_DROP,
    INDICES_TABLE_CREATE,
} from './queries';

interface INativeType {
    DATA_TYPE: string;
    data_type: string;
}

const testMetadata: ITestMetadata = {
    name: 'MSSQL',
    dialect: 'mssql',
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
                SELECT DATA_TYPE
                FROM information_schema.columns
                WHERE table_catalog='${schema}' AND table_name='${table}' AND column_name='${column}';
            `;

            const res = await connection.query(query, {
                type: QueryTypes.SELECT,
                raw: true,
            }) as INativeType[];

            return res[0].DATA_TYPE ?? res[0].data_type;
        },
        testValues: [
            ['int', 2147483647],
            ['integer', 2147483647],
            ['bigint', 9007199254740991],
            ['tinyint', 127],
            ['smallint', 32767],
            ['numeric', '99.999'],
            ['decimal', '99.999'],
            ['float', 15.23],
            ['real', 29.78],
            ['dec', '99.999'],
            ['money', 3500.25],
            ['char', 'A'],
            ['character', 'A'],
            ['nchar', 'A'],
            ['varchar', 'Mairubarelabarba'],
            ['nvarchar', 'inbarbaadunbarbaro'],
            ['text', 'quandoseiinveste'],
            ['ntext', 'dirabarbaro'],
            ['double', '99.999'],
            ['date', '2020-01-01'],
            // ['datetime', '2020-12-12 11:30:30.12345'],
            ['datetime2', new Date()],
            ['datetimeoffset', '2020-12-12 11:30:30.12345'],
            ['time', '23:59:59'],
            // ['timestamp', '2020-02-04 17:19:08.267'],
            // ['smalldatetime', ''],
            ['smallmoney', 3500.25],
            ['binary', Buffer.from('1 or 0')],
            ['bit', 1],
            ['uniqueidentifier', '0E984725-C51C-4BF4-9960-E1C80E27ABA0'],
            ['xml', '<parent><child>it</child></parent>'],
            ['varbinary', Buffer.from('1 or 0')],
        ]
    },
};

const testRunner = new TestRunner(testMetadata);
testRunner.run();
