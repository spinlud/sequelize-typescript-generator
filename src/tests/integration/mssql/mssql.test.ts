import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { ITestMetadata } from '../ITestMetadata.js';
import { TestRunner } from '../TestRunner.js';
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
    EMPLOYEES_TABLE_NAME,
    EMPLOYEES_TABLE_DROP,
    EMPLOYEES_TABLE_CREATES,
    EMPLOYEES_TABLE_INSERTS,
    PROFILES_TABLE_NAME,
    PROFILES_TABLE_DROP,
    PROFILES_TABLE_CREATES,
    PROFILES_TABLE_INSERTS,
    ORDER_LINES_TABLE_NAME,
    ORDER_LINES_TABLE_DROP,
    ORDER_LINES_TABLE_CREATES,
    ORDER_LINES_TABLE_INSERTS,
    SHIPMENTS_TABLE_NAME,
    SHIPMENTS_TABLE_DROP,
    SHIPMENTS_TABLE_CREATES,
    SHIPMENTS_TABLE_INSERTS,
    SOFT_DELETES_TABLE_NAME,
    SOFT_DELETES_TABLE_DROP,
    SOFT_DELETES_TABLE_CREATES,
    AUDITED_TABLE_NAME,
    AUDITED_TABLE_DROP,
    AUDITED_TABLE_CREATES,
    TENANTS_TABLE_NAME,
    TENANTS_TABLE_SCHEMA,
    TENANTS_TABLE_DROP,
    TENANTS_TABLE_CREATES,
    SETUP_QUERIES,
} from './queries.js';

interface INativeType {
    DATA_TYPE: string;
    data_type: string;
}

const testMetadata: ITestMetadata = {
    name: 'MSSQL',
    dialect: 'mssql',
    setupQueries: SETUP_QUERIES,
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
            name: EMPLOYEES_TABLE_NAME,
            createQueries: EMPLOYEES_TABLE_CREATES,
            dropQuery: EMPLOYEES_TABLE_DROP,
            insertQueries: EMPLOYEES_TABLE_INSERTS,
        },
        {
            name: PROFILES_TABLE_NAME,
            createQueries: PROFILES_TABLE_CREATES,
            dropQuery: PROFILES_TABLE_DROP,
            insertQueries: PROFILES_TABLE_INSERTS,
        },
        {
            name: ORDER_LINES_TABLE_NAME,
            createQueries: ORDER_LINES_TABLE_CREATES,
            dropQuery: ORDER_LINES_TABLE_DROP,
            insertQueries: ORDER_LINES_TABLE_INSERTS,
        },
        {
            name: SHIPMENTS_TABLE_NAME,
            createQueries: SHIPMENTS_TABLE_CREATES,
            dropQuery: SHIPMENTS_TABLE_DROP,
            insertQueries: SHIPMENTS_TABLE_INSERTS,
        },
        {
            name: SOFT_DELETES_TABLE_NAME,
            createQueries: SOFT_DELETES_TABLE_CREATES,
            dropQuery: SOFT_DELETES_TABLE_DROP,
        },
        {
            name: AUDITED_TABLE_NAME,
            createQueries: AUDITED_TABLE_CREATES,
            dropQuery: AUDITED_TABLE_DROP,
        },
        {
            name: TENANTS_TABLE_NAME,
            createQueries: TENANTS_TABLE_CREATES,
            dropQuery: TENANTS_TABLE_DROP,
        },
    ],
    filterTables: [ DATA_TYPES_TABLE_NAME ],
    filterSkipTables: [ INDICES_TABLE_NAME ],
    triggerTable: AUDITED_TABLE_NAME,
    secondarySchemaTable: { schema: TENANTS_TABLE_SCHEMA, name: TENANTS_TABLE_NAME },
    expectedForeignKeys: {
        [UNITS_TABLE_NAME]: [
            {
                constraintName: 'units_race_id_fk',
                sourceTable: 'units',
                sourceColumns: ['race_id'],
                targetSchema: 'dbo',
                targetTable: 'races',
                targetColumns: ['race_id'],
                onDelete: 'CASCADE',
                onUpdate: 'NO ACTION',
                isSourceColumnUnique: false,
            },
        ],
        [EMPLOYEES_TABLE_NAME]: [
            {
                constraintName: 'employees_manager_fk',
                sourceTable: 'employees',
                sourceColumns: ['manager_id'],
                targetSchema: 'dbo',
                targetTable: 'employees',
                targetColumns: ['employee_id'],
                onDelete: 'NO ACTION',
                onUpdate: 'NO ACTION',
                isSourceColumnUnique: false,
            },
        ],
        [PROFILES_TABLE_NAME]: [
            {
                constraintName: 'profiles_person_fk',
                sourceTable: 'profiles',
                sourceColumns: ['person_id'],
                targetSchema: 'dbo',
                targetTable: 'person',
                targetColumns: ['person_id'],
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
                isSourceColumnUnique: true,
            },
        ],
        [SHIPMENTS_TABLE_NAME]: [
            {
                constraintName: 'shipments_order_line_fk',
                sourceTable: 'shipments',
                sourceColumns: ['order_id', 'line_no'],
                targetSchema: 'dbo',
                targetTable: 'order_lines',
                targetColumns: ['order_id', 'line_no'],
                onDelete: 'NO ACTION',
                onUpdate: 'NO ACTION',
                isSourceColumnUnique: false,
            },
        ],
        [ORDER_LINES_TABLE_NAME]: [],
    },
    paranoidTable: SOFT_DELETES_TABLE_NAME,
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
        leftTableOneToOne: PERSON_TABLE_NAME,
        rightTableOneToOne: PASSPORT_TABLE_NAME,
        leftTableOneToMany: RACES_TABLE_NAME,
        rightTableOneToMany: UNITS_TABLE_NAME,
        leftTableManyToMany: AUTHORS_TABLE_NAME,
        rightTableManyToMany: BOOKS_TABLE_NAME,
    }
};

const testRunner = new TestRunner(testMetadata);
testRunner.run();
