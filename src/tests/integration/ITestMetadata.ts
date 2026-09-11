import { Dialect } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { IForeignKeyConstraintMetadata } from '../../dialects/Dialect.js';

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
    setupQueries?: string[];
    testTables: ITestTable[];
    testViews?: ITestTable[];
    filterTables: string[];
    filterSkipTables: string[];
    // Expected foreign key constraints per database table name.
    expectedForeignKeys: Record<string, IForeignKeyConstraintMetadata[]>;
    paranoidTable?: string;
    triggerTable?: string;
    secondarySchemaTable?: { schema: string; name: string };
    dataTypes: {
        dataTypesTable: string;
        // Should return the native data type for a given column in a table
        getColumnNativeDataType: GetColumnNativeDataTypeFn;
        testValues: [string, any][];
    },
    // Array columns (currently Postgres only). Drives a dedicated test block that
    // asserts the emitted data type expression and TypeScript type per column and
    // round-trips a sample value through the database.
    arrayTypes?: {
        arrayTypesTable: string;
        expected: {
            column: string; // Database column name, e.g. 'f_int_array'
            nativeType: string; // Native init-options expression, e.g. 'DataTypes.ARRAY(DataTypes.INTEGER)'
            decoratorType: string; // Decorators expression, e.g. 'DataType.ARRAY(DataType.INTEGER)'
            tsType: string; // Generated TypeScript type, e.g. 'number[]'
            value: unknown[]; // Sample value to round-trip
        }[];
    },
    // JSON/JSONB columns. Drives a dedicated test block that asserts the emitted
    // data type expression and TypeScript type per column, the presence of the
    // shared Json support file and its import, and round-trips an object, an
    // array and a top-level scalar through the JSON column.
    jsonTypes?: {
        jsonTypesTable: string;
        expected: {
            column: string; // Database column name, e.g. 'f_json'
            nativeType: string; // Native init-options expression, e.g. 'DataTypes.JSON'
            decoratorType: string; // Decorators expression, e.g. 'DataType.JSON'
            tsType: string; // Generated TypeScript type: 'Json' or 'string'
        }[];
        // Values round-tripped through the JSON column (the first expected entry
        // whose tsType is 'Json').
        roundTripValues: {
            object: Record<string, unknown>;
            array: unknown[];
            scalar: string | number | boolean;
        };
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
