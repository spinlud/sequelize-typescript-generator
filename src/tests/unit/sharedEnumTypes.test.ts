import path from 'path';
import * as ts from 'typescript';
import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { ModelBuilder } from '../../builders/ModelBuilder.js';
import { DialectPostgres } from '../../dialects/DialectPostgres.js';
import type { IConfig, ITypeOverrides } from '../../config/IConfig.js';
import type { IColumnEnumType, IColumnMetadata, ITableMetadata, ITablesMetadata } from '../../dialects/Dialect.js';
import { DATA_TYPE_NAMESPACES, renderDataTypeExpression } from '../../dialects/dataTypes.js';
import type { ISequelizeDataType } from '../../dialects/dataTypes.js';
import type { Format } from '../../config/format.js';
import { compileGeneratedModels } from '../integration/compileGeneratedModels.js';

const FORMATS_UNDER_TEST: Format[] = ['native', 'decorators'];

const ENUMS_FILE_NAME = 'enums.ts';

const dataType = (key: ISequelizeDataType['key'], ...args: ISequelizeDataType['args']): ISequelizeDataType => ({ key, args });

const enumType = (schema: string, name: string, labels: string[], isArray = false): IColumnEnumType => ({
    schema,
    name,
    labels,
    isArray,
});

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

/**
 * Build an enum column as the Postgres dialect reports it: the UDT name as its
 * type, an ENUM data type (wrapped in ARRAY for an array column) and the enum
 * reference.
 * @param {string} name
 * @param {IColumnEnumType} reference
 * @param {Partial<IColumnMetadata>} overrides
 * @returns {IColumnMetadata}
 */
const buildEnumColumn = (
    name: string,
    reference: IColumnEnumType,
    overrides: Partial<IColumnMetadata> = {}
): IColumnMetadata => {
    const enumDataType = dataType('ENUM', ...reference.labels);

    return buildColumn({
        name,
        type: reference.isArray ? `_${reference.name}` : reference.name,
        typeExt: reference.isArray ? 'ARRAY' : 'USER-DEFINED',
        sequelizeType: reference.isArray ? dataType('ARRAY', enumDataType) : enumDataType,
        enumType: reference,
        ...overrides,
    });
};

const buildIdColumn = (): IColumnMetadata =>
    buildColumn({ name: 'id', type: 'int4', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true });

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

const PLAN_TIER = enumType('public', 'plan_tier', ['free', 'pro', 'enterprise']);
const PLAN_TIER_ARRAY = enumType('public', 'plan_tier', ['free', 'pro', 'enterprise'], true);
const ACCOUNT_STATUS = enumType('public', 'account_status', ['active', 'closed']);

const buildAccountsTable = (): ITableMetadata => buildTable('accounts', [
    buildIdColumn(),
    buildEnumColumn('plan', PLAN_TIER),
    buildEnumColumn('past_plans', PLAN_TIER_ARRAY),
    buildEnumColumn('status', ACCOUNT_STATUS, { allowNull: true }),
    buildColumn({ name: 'name', type: 'text', sequelizeType: dataType('STRING') }),
]);

const buildInvoicesTable = (): ITableMetadata => buildTable('invoices', [
    buildIdColumn(),
    buildEnumColumn('plan', PLAN_TIER),
    buildColumn({ name: 'amount', type: 'int4', sequelizeType: dataType('INTEGER') }),
]);

const buildNotesTable = (): ITableMetadata => buildTable('notes', [
    buildIdColumn(),
    buildColumn({ name: 'body', type: 'text', sequelizeType: dataType('STRING') }),
]);

/**
 * Postgres dialect stub that returns fixed table metadata instead of querying a
 * live database.
 */
class StubDialect extends DialectPostgres {
    constructor(private readonly stubMetadata: ITablesMetadata) {
        super();
    }

    public async buildTablesMetadata(): Promise<ITablesMetadata> {
        return this.stubMetadata;
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

    return fs.mkdtemp(path.join(parent, 'stg-shared-enums-'));
};

const tempDirs: string[] = [];

afterAll(async () => {
    for (const dir of tempDirs) {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

/**
 * Build the given tables in the given format, returning every written file and
 * the captured warnings.
 * @param {Format} format
 * @param {ITableMetadata[]} tables
 * @param {ITypeOverrides} typeOverrides
 * @returns {Promise<IBuildResult>}
 */
const build = async (
    format: Format,
    tables: ITableMetadata[],
    typeOverrides?: ITypeOverrides
): Promise<IBuildResult> => {
    const outDir = await createProjectTempDir();
    tempDirs.push(outDir);
    const warnings: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
        warnings.push(args.map(arg => String(arg)).join(' '));
    });

    const config: IConfig = {
        connection: { dialect: 'postgres' },
        metadata: { ...typeOverrides && { typeOverrides } },
        output: { outDir, clean: false },
        format,
    };

    try {
        const tablesMetadata: ITablesMetadata = Object.fromEntries(tables.map(table => [table.name, table]));
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
 * Nullable rendering of a TypeScript type in the given format: native appends
 * `| null`, decorators keep the bare type.
 * @param {Format} format
 * @param {string} type
 * @returns {string}
 */
const nullable = (format: Format, type: string): string => format === 'native' ? `${type} | null` : type;

/**
 * Data type expression as emitted in the given format.
 * @param {Format} format
 * @param {string} expression
 * @returns {string}
 */
const dataTypeText = (format: Format, expression: string): string =>
    `type: ${expression.replace(/\$/g, format === 'native' ? 'DataTypes' : 'DataType')}`;

const enumsImport = (names: string[]): string => `import type { ${names.join(', ')} } from "./enums";`;

const formatDiagnostics = (diagnostics: readonly ts.Diagnostic[]): string[] =>
    diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

/**
 * String argument values of every `ENUM(...)` data type call in the given
 * source, in source order, as the TypeScript parser reads them.
 * @param {string} content
 * @returns {string[][]}
 */
const enumDataTypeLabels = (content: string): string[][] => {
    const sourceFile = ts.createSourceFile('model.ts', content, ts.ScriptTarget.Latest, true);
    const labels: string[][] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)
            && ts.isPropertyAccessExpression(node.expression)
            && node.expression.name.text === 'ENUM') {
            labels.push(node.arguments.filter(ts.isStringLiteral).map(argument => argument.text));
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return labels;
};

/**
 * Shared type declarations of the enums file, in file order.
 * @param {string} content
 * @returns {string[]}
 */
const declaredEnumTypes = (content: string): string[] =>
    content.split('\n').filter(line => line.startsWith('export type '));

describe.each(FORMATS_UNDER_TEST)('shared enum types (format: %s)', (format: Format) => {
    describe('enum columns', () => {
        let result: IBuildResult;

        beforeAll(async () => {
            result = await build(format, [buildAccountsTable(), buildInvoicesTable(), buildNotesTable()]);
        });

        it('emits one shared type per database enum, sorted by name, with labels in database order', () => {
            expect(declaredEnumTypes(result.files[ENUMS_FILE_NAME])).toEqual([
                'export type AccountStatus = "active" | "closed";',
                'export type PlanTier = "free" | "pro" | "enterprise";',
            ]);
        });

        it('type-only imports exactly the enum types each model uses', () => {
            expect(result.files['accounts.ts']).toContain(enumsImport(['AccountStatus', 'PlanTier']));
            expect(result.files['invoices.ts']).toContain(enumsImport(['PlanTier']));
            expect(result.files['notes.ts']).not.toContain('./enums');
        });

        it('types enum columns with the shared type, enum arrays with an array of it', () => {
            const accounts = result.files['accounts.ts'];

            expect(accounts).toMatch(columnTypePattern(format, 'plan', 'PlanTier'));
            expect(accounts).toMatch(columnTypePattern(format, 'past_plans', 'PlanTier[]'));
            expect(accounts).toMatch(columnTypePattern(format, 'status', nullable(format, 'AccountStatus')));
            expect(result.files['invoices.ts']).toMatch(columnTypePattern(format, 'plan', 'PlanTier'));
        });

        it('emits ENUM data types with the database labels', () => {
            const accounts = result.files['accounts.ts'];

            const labels = format === 'native' ? '"free", "pro", "enterprise"' : "'free','pro','enterprise'";

            expect(accounts).toContain(dataTypeText(format, `$.ENUM(${labels})`));
            expect(accounts).toContain(dataTypeText(format, `$.ARRAY($.ENUM(${labels}))`));
        });

        it('does not warn about unmapped types', () => {
            expect(result.warnings.filter(warning => warning.includes('Unmapped type'))).toEqual([]);
        });

        it('type-checks the generated output under strict mode', async () => {
            expect(formatDiagnostics(await compileGeneratedModels(result.outDir, format))).toEqual([]);
        });
    });

    it('emits no enums file when no column uses an enum', async () => {
        const result = await build(format, [buildNotesTable()]);

        expect(Object.keys(result.files)).not.toContain(ENUMS_FILE_NAME);
        expect(result.files['notes.ts']).not.toContain('./enums');
    });

    it('emits valid TypeScript that preserves enum labels with quotes, backslashes and newlines', async () => {
        const labels = ["it's", 'back\\slash', 'say "hi"', 'line\nbreak'];
        const reference = enumType('public', 'tricky_label', labels);
        const result = await build(format, [buildTable('labels', [buildIdColumn(), buildEnumColumn('label', reference)])]);

        expect(enumDataTypeLabels(result.files['labels.ts'])).toEqual([labels]);
        expect(formatDiagnostics(await compileGeneratedModels(result.outDir, format))).toEqual([]);
    });

    describe('type overrides', () => {
        it('drops the shared type of an enum whose TypeScript type every column overrides', async () => {
            const result = await build(format, [buildAccountsTable(), buildInvoicesTable()], {
                types: {
                    plan_tier: { tsType: '"free" | "paid"' },
                    _plan_tier: { tsType: 'string[]' },
                },
            });

            expect(declaredEnumTypes(result.files[ENUMS_FILE_NAME])).toEqual([
                'export type AccountStatus = "active" | "closed";',
            ]);
            expect(result.files['accounts.ts']).toContain(enumsImport(['AccountStatus']));
            expect(result.files['invoices.ts']).not.toContain('./enums');
            expect(result.files['accounts.ts']).toMatch(columnTypePattern(format, 'plan', '"free" | "paid"'));
            expect(formatDiagnostics(await compileGeneratedModels(result.outDir, format))).toEqual([]);
        });

        it('drops the enums file when the last enum shared type is overridden', async () => {
            const result = await build(format, [buildInvoicesTable()], {
                types: { plan_tier: { tsType: 'string' } },
            });

            expect(Object.keys(result.files)).not.toContain(ENUMS_FILE_NAME);
            expect(result.files['invoices.ts']).not.toContain('./enums');
            expect(formatDiagnostics(await compileGeneratedModels(result.outDir, format))).toEqual([]);
        });

        it('keeps the shared type when only the data type is overridden', async () => {
            const result = await build(format, [buildInvoicesTable()], {
                columns: { 'invoices.plan': { dataType: 'STRING' } },
            });

            expect(declaredEnumTypes(result.files[ENUMS_FILE_NAME])).toEqual([
                'export type PlanTier = "free" | "pro" | "enterprise";',
            ]);
            expect(result.files['invoices.ts']).toMatch(columnTypePattern(format, 'plan', 'PlanTier'));
            expect(result.files['invoices.ts']).toContain(dataTypeText(format, '$.STRING'));
        });

        it('matches a schema-qualified type key against the schema of the enum type', async () => {
            const billingPlan = enumType('billing', 'plan_tier', ['monthly', 'yearly']);
            const result = await build(format, [
                buildTable('subscriptions', [buildIdColumn(), buildEnumColumn('billing_plan', billingPlan)]),
            ], {
                types: { 'billing.plan_tier': { tsType: 'string' } },
            });

            expect(result.files['subscriptions.ts']).toMatch(columnTypePattern(format, 'billing_plan', 'string'));
            expect(Object.keys(result.files)).not.toContain(ENUMS_FILE_NAME);
            expect(result.warnings.filter(warning => warning.includes('matched no column'))).toEqual([]);
        });
    });

    describe('name clashes', () => {
        it('prefixes an enum from another schema with its schema when the names clash', async () => {
            const billingPlan = enumType('billing', 'plan_tier', ['monthly', 'yearly']);
            const result = await build(format, [
                buildTable('subscriptions', [
                    buildIdColumn(),
                    buildEnumColumn('plan', PLAN_TIER),
                    buildEnumColumn('billing_plan', billingPlan),
                ]),
            ]);

            expect(declaredEnumTypes(result.files[ENUMS_FILE_NAME])).toEqual([
                'export type BillingPlanTier = "monthly" | "yearly";',
                'export type PlanTier = "free" | "pro" | "enterprise";',
            ]);
            expect(result.files['subscriptions.ts']).toMatch(columnTypePattern(format, 'billing_plan', 'BillingPlanTier'));
            expect(result.files['subscriptions.ts']).toMatch(columnTypePattern(format, 'plan', 'PlanTier'));

            const clashWarnings = result.warnings.filter(warning => warning.includes('name clash'));
            expect(clashWarnings).toHaveLength(1);
            expect(clashWarnings[0]).toContain("'billing.plan_tier'");
            expect(clashWarnings[0]).toContain("'BillingPlanTier'");
            expect(formatDiagnostics(await compileGeneratedModels(result.outDir, format))).toEqual([]);
        });

        it('suffixes enums whose different names Pascal-case to the same identifier', async () => {
            const quotedPlanTier = enumType('public', 'PlanTier', ['basic']);
            const result = await build(format, [
                buildTable('subscriptions', [
                    buildIdColumn(),
                    buildEnumColumn('plan', PLAN_TIER),
                    buildEnumColumn('legacy_plan', quotedPlanTier),
                ]),
            ]);

            expect(declaredEnumTypes(result.files[ENUMS_FILE_NAME])).toEqual([
                'export type PlanTier = "basic";',
                'export type PlanTier2 = "free" | "pro" | "enterprise";',
            ]);
            expect(result.files['subscriptions.ts']).toMatch(columnTypePattern(format, 'plan', 'PlanTier2'));
            expect(result.files['subscriptions.ts']).toMatch(columnTypePattern(format, 'legacy_plan', 'PlanTier'));

            const clashWarnings = result.warnings.filter(warning => warning.includes('name clash'));
            expect(clashWarnings).toHaveLength(1);
            expect(clashWarnings[0]).toContain("'public.plan_tier'");
            expect(clashWarnings[0]).toContain("'PlanTier2'");
            expect(formatDiagnostics(await compileGeneratedModels(result.outDir, format))).toEqual([]);
        });

        it('suffixes an enum named like a generated model with Enum', async () => {
            const result = await build(format, [
                buildTable('PlanTier', [buildIdColumn(), buildEnumColumn('tier', PLAN_TIER)], { originName: 'plan_tiers' }),
            ]);

            expect(declaredEnumTypes(result.files[ENUMS_FILE_NAME])).toEqual([
                'export type PlanTierEnum = "free" | "pro" | "enterprise";',
            ]);
            expect(result.files['PlanTier.ts']).toMatch(columnTypePattern(format, 'tier', 'PlanTierEnum'));

            const clashWarnings = result.warnings.filter(warning => warning.includes('name clash'));
            expect(clashWarnings).toHaveLength(1);
            expect(clashWarnings[0]).toContain("'PlanTierEnum'");
            expect(clashWarnings[0]).toContain("model 'PlanTier'");
            expect(formatDiagnostics(await compileGeneratedModels(result.outDir, format))).toEqual([]);
        });

        it('suffixes an enum named like an identifier the model files import with Enum', async () => {
            const modelEnum = enumType('public', 'model', ['a', 'b']);
            const jsonEnum = enumType('public', 'json', ['c']);
            const result = await build(format, [
                buildTable('items', [
                    buildIdColumn(),
                    buildEnumColumn('kind', modelEnum),
                    buildEnumColumn('shape', jsonEnum),
                    buildColumn({ name: 'payload', type: 'jsonb', sequelizeType: dataType('JSONB'), isJson: true }),
                ]),
            ]);

            expect(declaredEnumTypes(result.files[ENUMS_FILE_NAME])).toEqual([
                'export type JsonEnum = "c";',
                'export type ModelEnum = "a" | "b";',
            ]);
            expect(result.warnings.filter(warning => warning.includes('name clash'))).toHaveLength(2);
            expect(formatDiagnostics(await compileGeneratedModels(result.outDir, format))).toEqual([]);
        });

        it('keeps the names when a type override removes a clashing enum', async () => {
            const billingPlan = enumType('billing', 'plan_tier', ['monthly', 'yearly']);
            const result = await build(format, [
                buildTable('subscriptions', [
                    buildIdColumn(),
                    buildEnumColumn('plan', PLAN_TIER),
                    buildEnumColumn('billing_plan', billingPlan),
                ]),
            ], {
                types: { 'public.plan_tier': { tsType: 'string' } },
            });

            expect(declaredEnumTypes(result.files[ENUMS_FILE_NAME])).toEqual([
                'export type BillingPlanTier = "monthly" | "yearly";',
            ]);
            expect(result.warnings.filter(warning => warning.includes('name clash'))).toHaveLength(1);
        });

        it('resolves the same names on every run', async () => {
            const tables = (): ITableMetadata[] => [
                buildTable('subscriptions', [
                    buildIdColumn(),
                    buildEnumColumn('legacy_plan', enumType('public', 'PlanTier', ['basic'])),
                    buildEnumColumn('billing_plan', enumType('billing', 'plan_tier', ['monthly'])),
                    buildEnumColumn('plan', PLAN_TIER),
                ]),
            ];
            const reversedTables = (): ITableMetadata[] => {
                const [table] = tables();
                const columns = Object.values(table.columns).reverse();

                return [buildTable(table.name, columns)];
            };

            const first = await build(format, tables());
            const second = await build(format, reversedTables());

            expect(declaredEnumTypes(second.files[ENUMS_FILE_NAME]))
                .toEqual(declaredEnumTypes(first.files[ENUMS_FILE_NAME]));
        });
    });

    describe('index barrel', () => {
        const initModelsExport = format === 'native' ? ['export * from "./initModels";'] : [];

        it('type-only re-exports the enums and Json shared type files', async () => {
            const result = await build(format, [
                buildAccountsTable(),
                buildTable('events', [
                    buildIdColumn(),
                    buildColumn({ name: 'payload', type: 'jsonb', sequelizeType: dataType('JSONB'), isJson: true }),
                ]),
            ]);

            expect(result.files['index.ts'].split('\n')).toEqual([
                'export * from "./accounts";',
                'export * from "./events";',
                'export type * from "./jsonType";',
                'export type * from "./enums";',
                ...initModelsExport,
            ]);
            expect(formatDiagnostics(await compileGeneratedModels(result.outDir, format))).toEqual([]);
        });

        it('re-exports no shared type file that is not emitted', async () => {
            const result = await build(format, [buildNotesTable()]);

            expect(result.files['index.ts'].split('\n')).toEqual([
                'export * from "./notes";',
                ...initModelsExport,
            ]);
        });

        it('re-exports the enums file alone when no column uses the Json type', async () => {
            const result = await build(format, [buildInvoicesTable()]);

            expect(result.files['index.ts']).toContain('export type * from "./enums";');
            expect(result.files['index.ts']).not.toContain('./jsonType');
        });
    });

    it('warns when a model file would overwrite the enums file', async () => {
        const result = await build(format, [
            buildTable('enums', [buildIdColumn(), buildEnumColumn('plan', PLAN_TIER)]),
        ]);

        expect(result.warnings.some(warning =>
            warning.includes("Model 'enums'") && warning.includes(ENUMS_FILE_NAME))).toBe(true);
    });
});
