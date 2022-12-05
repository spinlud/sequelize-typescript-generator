import { Dialect } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { ITable } from '../../dialects/Dialect';

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

interface ITestAssociationTableNames {
    oneToOne: {
        leftTable: string;  // Left table 1:1 relation
        rightTable: string; // Right table 1:1 relation
    },
    oneToMany: {
        leftTable: string;      // Left table 1:N relation
        rightTable: string;     // Right table 1:N relation
        rightKeys?: string[];   // Right table foreign keys (usually the more descriptive ones)
    },
    manyToMany: {
        leftTable: string;  // Left table N:N relation
        rightTable: string; // Right table N:N relation
    }
}

export interface ITestMetadata {
    name: string;
    dialect: Dialect;
    schema?: ITestSchema;
    testTables: ITestTable[];
    testViews?: ITestTable[];
    filterTables: ITable[];
    filterSkipTables: ITable[];
    dataTypes: {
        dataTypesTable: string;
        // Should return the native data type for a given column in a table
        getColumnNativeDataType: GetColumnNativeDataTypeFn;
        testValues: [string, any][];
    },
    associations: ITestAssociationTableNames & {
        navProps?: ITestAssociationTableNames
    }
}
