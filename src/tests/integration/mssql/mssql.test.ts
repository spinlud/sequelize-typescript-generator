import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
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

    HORSE_TABLE_NAME,
    HORSE_TABLE_DROP,
    HORSE_TABLE_CREATES,
    HORSE_TABLE_INSERTS,

    CODELOOKUP_TABLE_NAME,
    CODELOOKUP_TABLE_DROP,
    CODELOOKUP_TABLE_CREATES,
    CODELOOKUP_TABLE_INSERTS,

    SCHOLARSHIP_TABLE_NAME,
    SCHOLARSHIP_TABLE_DROP,
    SCHOLARSHIP_TABLE_CREATES,
    SCHOLARSHIP_TABLE_INSERTS,

    STUDENT_TABLE_NAME,
    STUDENT_TABLE_DROP,
    STUDENT_TABLE_CREATES,
    STUDENT_TABLE_INSERTS,

} from './queries';
import { ITable } from '../../../dialects/Dialect';
import { parseFullTableName } from '../../../dialects/utils';

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



        {
            name: HORSE_TABLE_NAME,
            createQueries: HORSE_TABLE_CREATES,
            dropQuery: HORSE_TABLE_DROP,
            insertQueries: HORSE_TABLE_INSERTS,
        },
        {
            name: CODELOOKUP_TABLE_NAME,
            createQueries: CODELOOKUP_TABLE_CREATES,
            dropQuery: CODELOOKUP_TABLE_DROP,
            insertQueries: CODELOOKUP_TABLE_INSERTS,
        },
        {
            name: SCHOLARSHIP_TABLE_NAME,
            createQueries: SCHOLARSHIP_TABLE_CREATES,
            dropQuery: SCHOLARSHIP_TABLE_DROP,
            insertQueries: SCHOLARSHIP_TABLE_INSERTS,
        },
        {
            name: STUDENT_TABLE_NAME,
            createQueries: STUDENT_TABLE_CREATES,
            dropQuery: STUDENT_TABLE_DROP,
            insertQueries: STUDENT_TABLE_INSERTS,
        },
    ],
    filterTables: [parseFullTableName(DATA_TYPES_TABLE_NAME) as ITable],
    filterSkipTables: [parseFullTableName(INDICES_TABLE_NAME) as ITable],
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
                WHERE table_catalog=N'${schema}' AND table_name=N'${table}' AND column_name=N'${column}';
            `;

            const res = await connection.query(query, {
                type: QueryTypes.SELECT,
                raw: true,
            }) as INativeType[];

            return res[0].DATA_TYPE ?? res[0].data_type;
        },
        testValues: [
            ['int', 2147483647],
            ['整数', 2147483647],
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
    associations: {
        oneToOne: {
            leftTable: PERSON_TABLE_NAME,
            rightTable: PASSPORT_TABLE_NAME,
        },
        oneToMany: {
            leftTable: RACES_TABLE_NAME,
            rightTable: UNITS_TABLE_NAME,
        },
        manyToMany: {
            leftTable: AUTHORS_TABLE_NAME,
            rightTable: BOOKS_TABLE_NAME,
        },
        navProps: {
            oneToOne: {
                leftTable: SCHOLARSHIP_TABLE_NAME,
                rightTable: STUDENT_TABLE_NAME,
            },
            oneToMany: {
                leftTable: CODELOOKUP_TABLE_NAME,
                rightTable: HORSE_TABLE_NAME,
                rightKeys: [
                    'horse_breed_id',
                    'horse_color_id',
                    'horse_gender_id',
                    'horse_status_id',
                ]
            },
            manyToMany: {
                leftTable: AUTHORS_TABLE_NAME,
                rightTable: BOOKS_TABLE_NAME,
            },
        }
    }
};

const testRunner = new TestRunner(testMetadata);
testRunner.run();
