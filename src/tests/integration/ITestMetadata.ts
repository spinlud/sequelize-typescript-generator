import { Dialect } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

interface ITestTable {
    name: string;
    dropQuery: string;
    createQueries: string[];
    insertQueries?: string[];
}

interface ITestSchema {
    name: string;
    createQuery: string;
    dropQuery: string;
}

type GetColumnNativeDataTypeFn = (
    connection: Sequelize,
    schema: string,
    table: string,
    column: string
) => Promise<string>;

export interface ITestMetadata {
    name: string;
    dialect: Dialect;
    schema?: ITestSchema;
    testTables: ITestTable[];
    testViews?: ITestTable[];
    filterTables: string[];
    filterSkipTables: string[];
    dataTypes: {
        dataTypesTable: string;
        // Should return the native data type for a given column in a table
        getColumnNativeDataType: GetColumnNativeDataTypeFn;
        testValues: [string, any][];
    },
    associations: {
        leftTableOneToOne: string; // Left table 1:1 relation
        rightTableOneToOne: string; // Right table 1:1 relation
        leftTableOneToMany: string; // Left table 1:N relation
        rightTableOneToMany: string; // Right table 1:N relation
        leftTableManyToMany: string; // Left table N:N relation
        rightTableManyToMany: string; // Right table N:N relation
    },
}
