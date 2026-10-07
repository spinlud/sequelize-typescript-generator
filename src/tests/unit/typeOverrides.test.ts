import path from 'path';
import * as ts from 'typescript';
import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { ModelBuilder } from '../../builders/ModelBuilder.js';
import { DialectSQLite } from '../../dialects/DialectSQLite.js';
import type { IConfig, IConfigMetadata, ITypeOverrides } from '../../config/IConfig.js';
import type { IColumnMetadata, ITableMetadata, ITablesMetadata } from '../../dialects/Dialect.js';
import { DATA_TYPE_NAMESPACES, renderDataTypeExpression } from '../../dialects/dataTypes.js';
import type { ISequelizeDataType } from '../../dialects/dataTypes.js';
import type { Format } from '../../config/format.js';
import { compileGeneratedModels } from '../integration/compileGeneratedModels.js';

const FORMATS_UNDER_TEST: Format[] = ['native', 'decorators'];

const UNMAPPED_DB_TYPE = 'geometry';

const dataType = (key: ISequelizeDataType['key'], ...args: ISequelizeDataType['args']): ISequelizeDataType => ({ key, args });

const buildColumn = (
    overrides: Partial<IColumnMetadata> & Pick<IColumnMetadata, 'name' | 'type'>
): IColumnMetadata => ({
    originName: overrides.name,
    typeExt: overrides.type,
    primaryKey: false,
    allowNull: false,
    autoIncrement: false,
    ...overrides.sequelizeType && {
        dataType: renderDataTypeExpression(overrides.sequelizeType, DATA_TYPE_NAMESPACES.decorators),
    },
    ...overrides,
});

const buildTable = (
    name: string,
    columns: IColumnMetadata[],
    overrides: Partial<ITableMetadata> = {}
): ITableMetadata => ({
    name,
    originName: name,
    schema: 'public',
    timestamps: false,
    columns: Object.fromEntries(columns.map(column => [column.name, column])),
    ...overrides,
});

const buildUsersTable = (): ITableMetadata => buildTable('users', [
    buildColumn({ name: 'id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'status', type: 'varchar', sequelizeType: dataType('STRING'), allowNull: true }),
    buildColumn({ name: 'nickname', type: 'varchar', sequelizeType: dataType('STRING'), allowNull: true }),
    buildColumn({ name: 'kind', type: 'enum', sequelizeType: dataType('ENUM', 'a', 'b') }),
    buildColumn({ name: 'location', type: UNMAPPED_DB_TYPE, allowNull: true }),
    buildColumn({ name: 'deleted_at', type: 'datetime', sequelizeType: dataType('DATE'), allowNull: true }),
], { paranoid: true, deletedAt: 'deleted_at' });

const buildDocumentsTable = (): ITableMetadata => buildTable('documents', [
    buildColumn({ name: 'id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'payload', type: 'json', sequelizeType: dataType('JSON'), isJson: true, allowNull: true }),
    buildColumn({ name: 'extra', type: 'json', sequelizeType: dataType('JSON'), isJson: true, allowNull: true }),
]);

const buildTablesMetadata = (): ITablesMetadata => ({
    users: buildUsersTable(),
    documents: buildDocumentsTable(),
});

/**
 * SQLite dialect stub that returns fixed table metadata and has no TypeScript
 * type mapping for `UNMAPPED_DB_TYPE`.
 */
class StubDialect extends DialectSQLite {
    constructor(private readonly stubMetadata: ITablesMetadata) {
        super();
    }

    public async buildTablesMetadata(): Promise<ITablesMetadata> {
        return this.stubMetadata;
    }

    public mapDbTypeToJs(dbType: string): string | undefined {
        return dbType === UNMAPPED_DB_TYPE ? undefined : super.mapDbTypeToJs(dbType);
    }
}

interface IBuildResult {
    outDir: string;
    files: Record<string, string>;
    warnings: string[];
}

/**
 * Create a scratch output directory inside the project, so the generated
 * models resolve the project's `sequelize` dependencies when type-checked.
 * @returns {Promise<string>}
 */
const createProjectTempDir = async (): Promise<string> => {
    const parent = path.join(process.cwd(), 'tmp');
    await fs.mkdir(parent, { recursive: true });

    return fs.mkdtemp(path.join(parent, 'stg-type-overrides-'));
};

const tempDirs: string[] = [];

afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

/**
 * Build the stub tables with the given metadata options in the given format,
 * returning every written file and the captured warnings.
 * @param {Format} format
 * @param {IConfigMetadata} metadata
 * @param {ITablesMetadata} tablesMetadata
 * @returns {Promise<IBuildResult>}
 */
const buildWithMetadata = async (
    format: Format,
    metadata: IConfigMetadata,
    tablesMetadata: ITablesMetadata = buildTablesMetadata()
): Promise<IBuildResult> => {
    const outDir = await createProjectTempDir();
    tempDirs.push(outDir);
    const warnings: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
        warnings.push(args.map(arg => String(arg)).join(' '));
    });

    const config: IConfig = {
        connection: { dialect: 'sqlite' },
        metadata,
        output: { outDir, clean: false },
        format,
    };

    try {
        await new ModelBuilder(config, new StubDialect(tablesMetadata)).build();
    }
    finally {
        warnSpy.mockRestore();
    }

    const files: Record<string, string> = {};

    for (const fileName of await fs.readdir(outDir)) {
        files[fileName] = await fs.readFile(path.join(outDir, fileName), 'utf8');
    }

    return { outDir, files, warnings };
};

const buildWithOverrides = (
    format: Format,
    typeOverrides: ITypeOverrides,
    tablesMetadata?: ITablesMetadata
): Promise<IBuildResult> => buildWithMetadata(format, { typeOverrides }, tablesMetadata);

/**
 * Match the declared TypeScript type of a column in either format: the native
 * `declare <column>: <type>;` member or the decorators `<column>?: <type>;` field.
 * @param {Format} format
 * @param {string} column
 * @param {string} type
 * @returns {RegExp}
 */
const columnTypePattern = (format: Format, column: string, type: string): RegExp => {
    const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return format === 'native'
        ? new RegExp(`declare ${column}: ${escaped};`)
        : new RegExp(`\\n\\s+${column}[?!]: ${escaped};`);
};

/**
 * Data type expression of a column as emitted in the given format.
 * @param {Format} format
 * @param {string} expression
 * @returns {string}
 */
const dataTypeText = (format: Format, expression: string): string =>
    `type: ${format === 'native' ? 'DataTypes' : 'DataType'}.${expression}`;

/**
 * Nullable rendering of a TypeScript type in the given format: native appends
 * `| null`, decorators keep the bare type.
 * @param {Format} format
 * @param {string} type
 * @returns {string}
 */
const nullable = (format: Format, type: string): string => format === 'native' ? `${type} | null` : type;

const formatDiagnostics = (diagnostics: readonly ts.Diagnostic[]): string[] =>
    diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

describe.each(FORMATS_UNDER_TEST)('type overrides (format: %s)', (format: Format) => {
    describe('precedence', () => {
        const ALL_KEYS: ITypeOverrides = {
            columns: {
                'public.users.status': { tsType: '1' },
                'users.status': { tsType: '2' },
            },
            types: {
                'public.varchar': { tsType: '3' },
                'varchar': { tsType: '4' },
            },
        };

        it('applies the schema-qualified column key first', async () => {
            const { files } = await buildWithOverrides(format, ALL_KEYS);

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'status', nullable(format, '1')));
        });

        it('applies the unqualified column key over type keys', async () => {
            const { files } = await buildWithOverrides(format, {
                columns: { 'users.status': { tsType: '2' } },
                types: ALL_KEYS.types,
            });

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'status', nullable(format, '2')));
        });

        it('applies the schema-qualified type key over the unqualified one', async () => {
            const { files } = await buildWithOverrides(format, { types: ALL_KEYS.types });

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'status', nullable(format, '3')));
            expect(files['users.ts']).toMatch(columnTypePattern(format, 'nickname', nullable(format, '3')));
        });

        it('applies the unqualified type key to every column of the type', async () => {
            const { files } = await buildWithOverrides(format, { types: { varchar: { tsType: '4' } } });

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'status', nullable(format, '4')));
            expect(files['users.ts']).toMatch(columnTypePattern(format, 'nickname', nullable(format, '4')));
        });

        it('resolves the TypeScript type and the data type independently', async () => {
            const { files } = await buildWithOverrides(format, {
                columns: { 'users.status': { tsType: '2' } },
                types: { varchar: { tsType: '4', dataType: 'TEXT' } },
            });

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'status', nullable(format, '2')));
            expect(files['users.ts']).toMatch(columnTypePattern(format, 'nickname', nullable(format, '4')));
            expect(files['users.ts'].split(dataTypeText(format, 'TEXT')).length - 1).toBe(2);
        });

        it('ignores a key whose schema does not match the table schema', async () => {
            const { files } = await buildWithOverrides(format, {
                columns: { 'auth.users.status': { tsType: '1' } },
                types: { 'auth.varchar': { tsType: '3' } },
            });

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'status', nullable(format, 'string')));
        });

        it('matches keys case-insensitively', async () => {
            const { files } = await buildWithOverrides(format, {
                columns: { 'PUBLIC.Users.STATUS': { tsType: '1' } },
                types: { VARCHAR: { dataType: 'DataTypes.TEXT' } },
            });

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'status', nullable(format, '1')));
            expect(files['users.ts']).toContain(dataTypeText(format, 'TEXT'));
        });
    });

    describe('partial overrides', () => {
        it('keeps the generated data type when only the TypeScript type is set', async () => {
            const { files } = await buildWithOverrides(format, { columns: { 'users.status': { tsType: '1' } } });

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'status', nullable(format, '1')));
            expect(files['users.ts']).toContain(dataTypeText(format, 'STRING'));
            expect(files['users.ts']).not.toContain(dataTypeText(format, 'TEXT'));
        });

        it('keeps the generated TypeScript type when only the data type is set', async () => {
            const { files } = await buildWithOverrides(format, {
                columns: { 'users.status': { dataType: 'STRING(32)' } },
            });

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'status', nullable(format, 'string')));
            expect(files['users.ts']).toContain(dataTypeText(format, 'STRING(32)'));
        });

        it('keeps the TypeScript type derived from the original data type when only the data type is set', async () => {
            const { files } = await buildWithOverrides(format, { columns: { 'users.kind': { dataType: 'STRING' } } });
            const generatedKindType = format === 'native' ? '"a" | "b"' : 'number';

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'kind', generatedKindType));
            expect(files['users.ts']).not.toContain('ENUM');
        });
    });

    describe('beats what the generator derives', () => {
        it('overrides an unmapped type without the unmapped-type warning', async () => {
            const { files, warnings } = await buildWithOverrides(format, {
                types: { geometry: { tsType: '{ x: number; y: number }', dataType: 'GEOMETRY' } },
            });

            expect(files['users.ts']).toContain('location');
            expect(files['users.ts']).toMatch(/location[?!]?: \{\s+x: number;\s+y: number;\s+\}/);
            expect(files['users.ts']).toContain(dataTypeText(format, 'GEOMETRY'));
            expect(warnings.some(warning => warning.includes('Unmapped type'))).toBe(false);
        });

        it('suppresses the unmapped-type warning for a data type only override', async () => {
            const { warnings } = await buildWithOverrides(format, {
                columns: { 'users.location': { dataType: 'GEOMETRY' } },
            });

            expect(warnings.some(warning => warning.includes('Unmapped type'))).toBe(false);
        });

        it('overrides an inline enum and the paranoid soft-delete column', async () => {
            const { files } = await buildWithOverrides(format, {
                columns: {
                    'users.kind': { tsType: 'string', dataType: 'STRING' },
                    'users.deleted_at': { tsType: 'string' },
                },
            });

            expect(files['users.ts']).toMatch(columnTypePattern(format, 'kind', 'string'));
            expect(files['users.ts']).not.toContain('ENUM');
            expect(files['users.ts']).toMatch(columnTypePattern(
                format,
                'deleted_at',
                format === 'native' ? 'CreationOptional<string | null>' : 'string'
            ));
        });

        it('overrides a foreign key column and keeps the native ForeignKey brand', async () => {
            const tablesMetadata = buildTablesMetadata();
            tablesMetadata.users.columns.nickname = buildColumn({
                name: 'nickname',
                type: 'integer',
                sequelizeType: dataType('INTEGER'),
                allowNull: true,
                foreignKey: { name: 'nickname', targetModel: 'documents', targetKey: 'id' },
            });

            const { outDir, files } = await buildWithOverrides(
                format,
                {
                    columns: { 'users.nickname': { tsType: '7' } },
                    types: { geometry: { dataType: 'GEOMETRY' } },
                },
                tablesMetadata
            );

            expect(files['users.ts']).toMatch(columnTypePattern(
                format,
                'nickname',
                format === 'native' ? 'ForeignKey<7 | null>' : '7'
            ));
            expect(formatDiagnostics(await compileGeneratedModels(outDir, format))).toEqual([]);
        });

        it('drops the shared Json type when no JSON column still uses it', async () => {
            const { files } = await buildWithOverrides(format, {
                types: { json: { tsType: 'Record<string, string>' } },
            });

            expect(files['jsonType.ts']).toBeUndefined();
            expect(files['documents.ts']).not.toContain('jsonType');
            expect(files['documents.ts']).toMatch(
                columnTypePattern(format, 'payload', nullable(format, 'Record<string, string>'))
            );
            expect(files['documents.ts']).toContain(dataTypeText(format, 'JSON'));
        });

        it('keeps the shared Json type while a JSON column still uses it', async () => {
            const { files } = await buildWithOverrides(format, {
                columns: { 'documents.payload': { tsType: 'Record<string, string>' } },
            });

            expect(files['jsonType.ts']).toContain('export type Json');
            expect(files['documents.ts']).toContain('import type { Json } from "./jsonType"');
            expect(files['documents.ts']).toMatch(columnTypePattern(format, 'extra', nullable(format, 'Json')));
        });
    });

    describe('strict compile', () => {
        it('emits output that type-checks with rich override types', async () => {
            const { outDir, files } = await buildWithOverrides(format, {
                types: {
                    geometry: { tsType: '{ type: "Point"; coordinates: [number, number] }', dataType: 'DataTypes.GEOMETRY' },
                    json: { tsType: 'Array<{ id: number }> | null' },
                },
                columns: {
                    'users.status': { tsType: "import('sequelize').Optional<{ a: string; b: number }, 'a'>" },
                    'users.nickname': { tsType: '(() => void) | string', dataType: 'STRING(64)' },
                    'users.kind': { dataType: `ENUM("it's", 'a\\\\b', "c")` },
                    'documents.extra': { tsType: 'string[]', dataType: 'ARRAY(DataType.TEXT)' },
                },
            });

            expect(files['users.ts']).toMatch(/import\(["']sequelize["']\)\.Optional</);
            expect(files['users.ts']).toContain(dataTypeText(format, 'ENUM('));

            const diagnostics = await compileGeneratedModels(outDir, format);
            expect(formatDiagnostics(diagnostics)).toEqual([]);
        });
    });
});

describe('type overrides warnings', () => {
    it('warns once listing the entries that matched no column', async () => {
        const { warnings } = await buildWithOverrides('native', {
            types: { tsvector: { tsType: 'string' }, varchar: { tsType: 'string' } },
            columns: { 'users.missing': { tsType: 'string' }, 'users.status': { tsType: 'string' } },
        });

        const unmatched = warnings.filter(warning => warning.includes('matched no column'));
        expect(unmatched).toHaveLength(1);
        expect(unmatched[0]).toMatch(/^\[WARNING\] /);
        expect(unmatched[0]).toContain('types["tsvector"]');
        expect(unmatched[0]).toContain('columns["users.missing"]');
        expect(unmatched[0]).not.toContain('varchar');
        expect(unmatched[0]).not.toContain('users.status');
        expect(unmatched[0]).toContain('table filters');
    });

    it('does not warn when every entry matched a column', async () => {
        const { warnings } = await buildWithOverrides('native', { types: { varchar: { tsType: 'string' } } });

        expect(warnings.some(warning => warning.includes('matched no column'))).toBe(false);
    });
});

describe('type overrides input', () => {
    it('reads the type overrides file', async () => {
        const dir = await createProjectTempDir();
        tempDirs.push(dir);
        const filePath = path.join(dir, 'overrides.json');
        await fs.writeFile(filePath, JSON.stringify({ columns: { 'users.status': { tsType: '1' } } }));

        const { files } = await buildWithMetadata('native', { typeOverridesFile: filePath });

        expect(files['users.ts']).toMatch(columnTypePattern('native', 'status', '1 | null'));
    });

    it('rejects a type overrides file that does not exist', async () => {
        const filePath = path.join(process.cwd(), 'tmp', 'missing-type-overrides.json');

        await expect(buildWithMetadata('native', { typeOverridesFile: filePath }))
            .rejects.toThrow(/\[ValidationError\].*missing-type-overrides\.json/);
    });

    it('rejects a type overrides file with invalid JSON', async () => {
        const dir = await createProjectTempDir();
        tempDirs.push(dir);
        const filePath = path.join(dir, 'overrides.json');
        await fs.writeFile(filePath, '{ "types": ');

        await expect(buildWithMetadata('native', { typeOverridesFile: filePath }))
            .rejects.toThrow(/\[ValidationError\].*overrides\.json.*JSON/);
    });

    it('rejects both typeOverridesFile and typeOverrides', async () => {
        await expect(buildWithMetadata('native', {
            typeOverridesFile: 'overrides.json',
            typeOverrides: { types: {} },
        })).rejects.toThrow(/\[ValidationError\].*typeOverridesFile.*typeOverrides/);
    });

    it('writes no files when validation fails', async () => {
        const outDir = await createProjectTempDir();
        tempDirs.push(outDir);
        const config: IConfig = {
            connection: { dialect: 'sqlite' },
            metadata: { typeOverrides: { types: { varchar: {} } } },
            output: { outDir, clean: false },
        };

        await expect(new ModelBuilder(config, new StubDialect(buildTablesMetadata())).build()).rejects.toThrow();
        expect(await fs.readdir(outDir)).toEqual([]);
    });
});

/**
 * Validation cases: a type overrides value and a pattern the error must match,
 * which names the offending entry.
 */
const VALIDATION_CASES: Array<[string, unknown, RegExp]> = [
    ['a non-object root', [], /root must be an object/],
    ['a null root', null, /root must be an object/],
    ['an unknown top-level key', { tables: {} }, /unknown section "tables"/],
    ['a non-object section', { types: [] }, /types must be an object/],
    ['an entry that is not an object', { types: { varchar: 'string' } }, /types\["varchar"\] must be an object/],
    ['an entry with neither field', { types: { varchar: {} } }, /types\["varchar"\].*tsType.*dataType/],
    ['an entry with an unknown field', { columns: { 'users.status': { tsType: 'string', nullable: true } } }, /columns\["users\.status"\].*unknown field "nullable"/],
    ['a non-string tsType', { types: { varchar: { tsType: 1 } } }, /types\["varchar"\]\.tsType must be a string/],
    ['a non-string dataType', { types: { varchar: { dataType: false } } }, /types\["varchar"\]\.dataType must be a string/],
    ['a type key with too many segments', { types: { 'a.b.c': { tsType: 'string' } } }, /types\["a\.b\.c"\].*key/],
    ['a type key with an empty segment', { types: { 'public.': { tsType: 'string' } } }, /types\["public\."\].*key/],
    ['a column key with one segment', { columns: { status: { tsType: 'string' } } }, /columns\["status"\].*key/],
    ['a column key with too many segments', { columns: { 'a.b.c.d': { tsType: 'string' } } }, /columns\["a\.b\.c\.d"\].*key/],
    ['a column key with an empty segment', { columns: { 'users..status': { tsType: 'string' } } }, /columns\["users\.\.status"\].*key/],
    ['keys differing only by case', { types: { varchar: { tsType: 'string' }, VARCHAR: { tsType: 'string' } } }, /types\["VARCHAR"\].*duplicate/],
    ['an unparsable tsType', { types: { varchar: { tsType: 'string |' } } }, /types\["varchar"\]\.tsType/],
    ['an empty tsType', { types: { varchar: { tsType: '  ' } } }, /types\["varchar"\]\.tsType/],
    ['a tsType carrying extra statements', { types: { varchar: { tsType: 'string; export const x = 1' } } }, /types\["varchar"\]\.tsType/],
    ['an unparsable dataType', { types: { varchar: { dataType: 'STRING(' } } }, /types\["varchar"\]\.dataType/],
    ['a dataType carrying extra statements', { types: { varchar: { dataType: 'STRING; process.exit()' } } }, /types\["varchar"\]\.dataType/],
    ['a dataType with a disallowed expression', { types: { varchar: { dataType: 'STRING(1 + 1)' } } }, /types\["varchar"\]\.dataType/],
    ['a dataType with a disallowed namespace', { types: { varchar: { dataType: 'Sequelize.STRING' } } }, /types\["varchar"\]\.dataType/],
    ['a dataType with a template literal', { types: { varchar: { dataType: 'ENUM(`a`)' } } }, /types\["varchar"\]\.dataType/],
    ['a dataType with an unknown key', { types: { varchar: { dataType: 'VARCHAR2(10)' } } }, /types\["varchar"\]\.dataType.*unknown data type "VARCHAR2"/],
    ['a dataType with an unknown nested key', { types: { varchar: { dataType: 'ARRAY(FOO)' } } }, /types\["varchar"\]\.dataType.*unknown data type "FOO"/],
];

describe('type overrides validation', () => {
    it.each(VALIDATION_CASES)('rejects %s', async (_name, typeOverrides, pattern) => {
        const dir = await createProjectTempDir();
        tempDirs.push(dir);
        const filePath = path.join(dir, 'overrides.json');
        await fs.writeFile(filePath, JSON.stringify(typeOverrides));

        const error = await buildWithMetadata('native', { typeOverridesFile: filePath }).then(
            () => undefined,
            (reason: unknown) => reason
        );

        expect(error).toBeInstanceOf(Error);
        expect(error instanceof Error ? error.message : '').toMatch(/^\[ValidationError\] /);
        expect(error instanceof Error ? error.message : '').toMatch(pattern);
    });
});
