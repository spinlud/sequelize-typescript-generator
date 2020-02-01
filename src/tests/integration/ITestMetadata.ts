import { Dialect } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

interface ITestTable {
    name: string;
    createQueries: string[];
    dropQuery: string;
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
    filterTables: string[];
    filterSkipTables: string[];
    dataTypes: {
        dataTypesTable: string;
        // Should return the native data type for a given column in a table
        getColumnNativeDataType: GetColumnNativeDataTypeFn;
        testValues: [string, any][];
    }
}
