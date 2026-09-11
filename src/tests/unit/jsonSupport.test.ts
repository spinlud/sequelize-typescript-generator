import { renderNativeFiles } from '../../builders/generatedFile.js';
import {
    buildJsonTypeImport,
    findJsonSupportFileNameCollision,
    JSON_SUPPORT_FILE_NAME,
    renderJsonSupportFile,
    tableHasJsonColumn,
    tablesHaveJsonColumn,
} from '../../builders/jsonSupport.js';
import { nodeToString } from '../../builders/utils.js';
import { DialectSQLite } from '../../dialects/DialectSQLite.js';
import type { IColumnMetadata, ITableMetadata, ITablesMetadata } from '../../dialects/Dialect.js';
import type { ISequelizeDataType } from '../../dialects/dataTypes.js';

const dialect = new DialectSQLite();

const dataType = (key: ISequelizeDataType['key'], ...args: ISequelizeDataType['args']): ISequelizeDataType => ({ key, args });

const buildColumn = (
    overrides: Partial<IColumnMetadata> & Pick<IColumnMetadata, 'name' | 'type'>
): IColumnMetadata => ({
    originName: overrides.name,
    typeExt: overrides.type,
    primaryKey: false,
    allowNull: false,
    autoIncrement: false,
    ...overrides,
});

const buildTable = (
    name: string,
    columns: IColumnMetadata[]
): ITableMetadata => ({
    name,
    originName: name,
    timestamps: false,
    columns: Object.fromEntries(columns.map(column => [column.name, column])),
});

const jsonTable = buildTable('documents', [
    buildColumn({ name: 'id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'payload', type: 'json', sequelizeType: dataType('JSON'), isJson: true, allowNull: true }),
]);

const plainTable = buildTable('races', [
    buildColumn({ name: 'race_id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'race_name', type: 'varchar', sequelizeType: dataType('STRING') }),
]);

describe('renderJsonSupportFile', () => {
    it('renders the recursive Json union', () => {
        const source = renderJsonSupportFile();

        expect(source).toContain('export type Json =');
        expect(source).toContain('string');
        expect(source).toContain('number');
        expect(source).toContain('boolean');
        expect(source).toContain('null');
        expect(source).toContain('Json[]');
        expect(source).toContain('[key: string]: Json');
    });
});

describe('buildJsonTypeImport', () => {
    it('renders a type-only import from the sibling support file', () => {
        expect(nodeToString(buildJsonTypeImport())).toBe('import type { Json } from "./jsonType";');
    });
});

describe('tableHasJsonColumn / tablesHaveJsonColumn', () => {
    it('detects a JSON column on a table', () => {
        expect(tableHasJsonColumn(jsonTable)).toBe(true);
        expect(tableHasJsonColumn(plainTable)).toBe(false);
    });

    it('detects a JSON column across tables', () => {
        expect(tablesHaveJsonColumn({ races: plainTable })).toBe(false);
        expect(tablesHaveJsonColumn({ races: plainTable, documents: jsonTable })).toBe(true);
    });
});

describe('findJsonSupportFileNameCollision', () => {
    it('reports a model whose name collides with the support file base name', () => {
        const collidingTable = buildTable('jsonType', [
            buildColumn({ name: 'payload', type: 'json', sequelizeType: dataType('JSON'), isJson: true }),
        ]);

        expect(findJsonSupportFileNameCollision({ jsonType: collidingTable })).toBe('jsonType');
        expect(findJsonSupportFileNameCollision({ documents: jsonTable })).toBeUndefined();
    });
});

describe('renderNativeFiles JSON support file', () => {
    it('emits the support file and a Json import only when a JSON column exists', () => {
        const tablesMetadata: ITablesMetadata = { documents: jsonTable };
        const files = renderNativeFiles(tablesMetadata, dialect);

        expect(files.some(file => file.fileName === JSON_SUPPORT_FILE_NAME)).toBe(true);

        const model = files.find(file => file.fileName === 'documents.ts');
        expect(model?.content).toContain('import type { Json } from "./jsonType"');
        expect(model?.content).toContain('payload: Json | null');
    });

    it('omits the support file when no table has a JSON column', () => {
        const files = renderNativeFiles({ races: plainTable }, dialect);

        expect(files.some(file => file.fileName === JSON_SUPPORT_FILE_NAME)).toBe(false);

        const model = files.find(file => file.fileName === 'races.ts');
        expect(model?.content).not.toContain('./jsonType');
    });
});
