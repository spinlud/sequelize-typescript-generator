import { Dialect } from 'sequelize';

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

export interface ITestMetadata {
    name: string;
    dialect: Dialect;
    schema?: ITestSchema;
    testTables: ITestTable[];
    filterTables: string[];
    filterSkipTables: string[];
    dataTypes: {
        dataTypesTable: string;
        testValues: [string, any][];
    }
}
