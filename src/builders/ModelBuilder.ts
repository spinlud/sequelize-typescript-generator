import { promises as fs } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import { Linter } from '../lint/index.js';
import { ModelAttributeColumnOptions } from 'sequelize';
import type { BelongsToOptions, HasManyOptions, HasOneOptions } from 'sequelize';
import type { IndexOptions, IndexFieldOptions, TableOptions } from 'sequelize-typescript';
import { IConfig } from '../config/index.js';
import { resolveFormat, shouldNoticeIgnoredStrict, STRICT_IGNORED_NOTICE } from '../config/format.js';
import {IColumnMetadata, ITableMetadata, IIndexMetadata, Dialect, ITablesMetadata} from '../dialects/Dialect.js';
import { IAssociationMetadata } from '../dialects/AssociationsParser.js';
import { DATA_TYPE_NAMESPACES } from '../dialects/dataTypes.js';
import { isErrnoException } from '../utils/errors.js';
import { Builder } from './Builder.js';
import { resolveAssociationPropertyName } from './associationNaming.js';
import { IGeneratedFile, renderNativeFiles, writeGeneratedFiles } from './generatedFile.js';
import { warnWhenDecoratorsDependencyIsMissing } from './decoratorsDependency.js';
import {
    attachColumnCommentJsDoc,
    buildDataTypeExpression,
    nodeToString,
    createGenericTypeReference,
    createTypeNodeFromName,
    generateArrowDecorator,
    generateNamedImports,
    generateObjectLiteralDecorator,
    generateIndexExport,
} from './utils.js';
import {
    buildJsonTypeImport,
    JSON_SUPPORT_FILE_NAME,
    JSON_TYPE_NAME,
    renderJsonSupportFile,
    tableHasJsonColumn,
    tablesHaveJsonColumn,
    warnJsonSupportFileNameCollision,
} from './jsonSupport.js';
import {
    assignSharedEnumTypeNames,
    buildEnumColumnTypeNode,
    buildEnumTypesImport,
    ENUM_SUPPORT_FILE_NAME,
    renderEnumSupportFile,
    tablesHaveSharedEnumType,
    warnEnumSupportFileNameCollision,
} from './enumSupport.js';
import type { IReservedIdentifiers } from './enumSupport.js';
import { indexTablesByModelName } from './nativeAttributes.js';
import { collectSequelizeImports } from './nativeAssociations.js';
import { UNMAPPED_TS_TYPE_BY_FORMAT, warnUnmappedTypes } from './unmappedTypes.js';
import { loadTypeOverrides } from './typeOverridesParser.js';
import { applyTypeOverrides, warnUnmatchedTypeOverrides } from './typeOverrides.js';

export { resolveAssociationPropertyName } from './associationNaming.js';

const foreignKeyDecorator = 'ForeignKey';

/**
 * Names every decorators model file imports from `sequelize-typescript`.
 */
const DECORATORS_BASE_IMPORTS = [
    'Model',
    'Table',
    'Column',
    'DataType',
    'Index',
    'Sequelize',
    foreignKeyDecorator,
] as const;

/**
 * Association decorators a decorators model file may import from `sequelize-typescript`.
 */
const ASSOCIATION_DECORATORS = ['BelongsTo', 'BelongsToMany', 'HasMany', 'HasOne'] as const;

/**
 * Global type names a generated model references.
 */
const REFERENCED_GLOBAL_TYPE_NAMES = ['Date'] as const;

/**
 * Leftmost identifier of an entity name, e.g. `ns` for `ns.Inner.Type`.
 * @param {ts.EntityName} name
 * @returns {ts.Identifier}
 */
const leftmostIdentifier = (name: ts.EntityName): ts.Identifier =>
    ts.isIdentifier(name) ? name : leftmostIdentifier(name.left);

/**
 * Collect the identifiers a type node references by name: the leftmost
 * identifier of every type reference and type query.
 * @param {ts.Node} node
 * @param {Set<string>} identifiers
 * @returns {void}
 */
const collectReferencedIdentifiers = (node: ts.Node, identifiers: Set<string>): void => {
    if (ts.isTypeReferenceNode(node)) {
        identifiers.add(leftmostIdentifier(node.typeName).text);
    }
    else if (ts.isTypeQueryNode(node)) {
        identifiers.add(leftmostIdentifier(node.exprName).text);
    }

    ts.forEachChild(node, child => collectReferencedIdentifiers(child, identifiers));
};

/**
 * Collect the identifiers the enum shared type names must not take in either
 * format: the generated model names, and every other name a model file declares
 * (decorators attributes interfaces), imports (`sequelize`/`sequelize-typescript`
 * names, the `Json` shared type) or references (global types, dialect type
 * names, type override TypeScript types).
 * @param {ITablesMetadata} tablesMetadata
 * @param {Dialect} dialect
 * @returns {IReservedIdentifiers}
 */
const collectReservedIdentifiers = (tablesMetadata: ITablesMetadata, dialect: Dialect): IReservedIdentifiers => {
    const tables = Object.values(tablesMetadata);
    const tablesByModel = indexTablesByModelName(tablesMetadata);
    const nonModelIdentifiers = new Set<string>([
        ...DECORATORS_BASE_IMPORTS,
        ...ASSOCIATION_DECORATORS,
        ...REFERENCED_GLOBAL_TYPE_NAMES,
        JSON_TYPE_NAME,
    ]);

    for (const table of tables) {
        nonModelIdentifiers.add(`${table.name}Attributes`);
        collectSequelizeImports(table, tablesByModel).forEach(name => nonModelIdentifiers.add(name));

        for (const column of Object.values(table.columns)) {
            const jsType = dialect.mapDbTypeToJs(column.type);

            if (jsType) {
                nonModelIdentifiers.add(jsType.replace(/(\[\])+$/, ''));
            }

            if (column.typeOverride?.tsType) {
                collectReferencedIdentifiers(column.typeOverride.tsType, nonModelIdentifiers);
            }
        }
    }

    return { modelNames: new Set(tables.map(table => table.name)), nonModelIdentifiers };
};

/**
 * Build the TypeScript type node of a column: a type override's TypeScript type,
 * the shared `Json` type for a JSON column, the enum shared type for a database
 * enum column, otherwise the dialect JS mapping, or `any` for an unmapped type.
 * @param {IColumnMetadata} col
 * @param {Dialect} dialect
 * @returns {ts.TypeNode}
 */
const buildColumnTypeNode = (col: IColumnMetadata, dialect: Dialect): ts.TypeNode => {
    const overriddenTsType = col.typeOverride?.tsType;

    if (overriddenTsType) {
        return overriddenTsType;
    }

    if (col.isJson) {
        return createGenericTypeReference(JSON_TYPE_NAME, []);
    }

    return col.enumType
        ? buildEnumColumnTypeNode(col.enumType)
        : createTypeNodeFromName(dialect.mapDbTypeToJs(col.type) ?? UNMAPPED_TS_TYPE_BY_FORMAT.decorators);
};

/**
 * `@Column` decorator options. The `type` option is either the rendered data type
 * expression text or, for a type override's data type, a compiler expression.
 */
type ColumnDecoratorProps = Omit<Partial<ModelAttributeColumnOptions>, 'type'> & {
    type?: string | ts.Expression;
};

/**
 * Build the `type` option of the `@Column` decorator: a type override's data type
 * is built as a compiler expression, otherwise the rendered data type expression.
 * @param {IColumnMetadata} col
 * @returns {string | ts.Expression | undefined}
 */
const buildColumnDecoratorType = (col: IColumnMetadata): string | ts.Expression | undefined => {
    const overriddenDataType = col.typeOverride?.dataType;

    return overriddenDataType
        ? buildDataTypeExpression(overriddenDataType, DATA_TYPE_NAMESPACES.decorators)
        : col.dataType;
};

/**
 * Build the `@Table` decorator options for a table. The `hasTrigger` flag is
 * emitted only when the source table carries at least one enabled trigger.
 * @param {ITableMetadata} tableMetadata
 * @returns {Partial<TableOptions>}
 */
export const buildTableDecoratorProps = (tableMetadata: ITableMetadata): Partial<TableOptions> => ({
    tableName: tableMetadata.originName,
    ...tableMetadata.schema && { schema: tableMetadata.schema },
    timestamps: tableMetadata.timestamps,
    ...tableMetadata.paranoid && { paranoid: true },
    ...tableMetadata.deletedAt && { deletedAt: tableMetadata.deletedAt },
    ...tableMetadata.hasTrigger && { hasTrigger: true },
    ...tableMetadata.comment && { comment: tableMetadata.comment },
});

/**
 * Decorator options accepted by `@BelongsTo`, `@HasOne` and `@HasMany`.
 */
export type AssociationDecoratorOptions = Partial<BelongsToOptions & HasManyOptions & HasOneOptions>;

/**
 * Build the decorator options for `@BelongsTo`, `@HasOne` and `@HasMany`. Keys
 * are emitted in the fixed order as, foreignKey, targetKey, sourceKey, onDelete,
 * onUpdate, and `as` is emitted only when the association carries an alias.
 * Returns undefined when no option applies so the decorator is rendered without
 * an options argument.
 * @param {IAssociationMetadata} association
 * @returns {AssociationDecoratorOptions | undefined}
 */
export const buildAssociationDecoratorProps = (
    association: IAssociationMetadata
): AssociationDecoratorOptions | undefined => {
    const props: AssociationDecoratorOptions = {
        ...association.alias && { as: association.alias },
        ...association.foreignKey && { foreignKey: association.foreignKey },
        ...association.targetKey && { targetKey: association.targetKey },
        ...association.sourceKey && { sourceKey: association.sourceKey },
        ...association.onDelete && { onDelete: association.onDelete },
        ...association.onUpdate && { onUpdate: association.onUpdate },
    };

    return Object.keys(props).length ? props : undefined;
};

/**
 * Build the association class member for a model.
 * @param {IAssociationMetadata} association
 * @returns {ts.PropertyDeclaration}
 */
export const buildAssociationPropertyDecl = (association: IAssociationMetadata): ts.PropertyDeclaration => {
    const { associationName, targetModel, joinModel } = association;

    const targetModels = [ targetModel ];
    joinModel && targetModels.push(joinModel);

    const decoratorProps = buildAssociationDecoratorProps(association);

    return ts.factory.createPropertyDeclaration(
        [
            decoratorProps ?
                generateArrowDecorator(associationName, targetModels, decoratorProps) :
                generateArrowDecorator(associationName, targetModels),
        ],
        resolveAssociationPropertyName(association),
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        associationName.includes('Many') ?
            ts.factory.createArrayTypeNode(ts.factory.createTypeReferenceNode(targetModel, undefined)) :
            ts.factory.createTypeReferenceNode(targetModel, undefined),
        undefined,
    );
};

/**
 * @class ModelGenerator
 * @constructor
 * @param {Dialect} dialect
 */
export class ModelBuilder extends Builder {
    constructor(config: IConfig, dialect: Dialect) {
        super(config, dialect);
    }

    /**
     * Build column class member
     * @param {IColumnMetadata} col
     * @param {Dialect} dialect
     */
    private static buildColumnPropertyDecl(col: IColumnMetadata, dialect: Dialect): ts.PropertyDeclaration {

        const buildColumnDecoratorProps = (col: IColumnMetadata): ColumnDecoratorProps => {
            const columnType = buildColumnDecoratorType(col);
            const props: ColumnDecoratorProps = {
                ...col.originName && col.name !== col.originName && { field: col.originName },
                ...col.primaryKey && { primaryKey: col.primaryKey },
                ...col.autoIncrement && { autoIncrement: col.autoIncrement },
                ...col.allowNull && { allowNull: col.allowNull },
                ...columnType && { type: columnType },
                ...col.comment && { comment: col.comment },
                ...col.defaultValue !== undefined && { defaultValue: dialect.mapDefaultValueToSequelize(col.defaultValue) },
            };

            return props;
        };

        const buildIndexDecoratorProps = (index: IIndexMetadata): Partial<IndexOptions & IndexFieldOptions> => {
            const props: Partial<IndexOptions & IndexFieldOptions> = {
                name: index.name,
                ...index.using && { using: index.using },
                ...index.collation && { order: index.collation === 'A' ? 'ASC' : 'DESC' },
                unique: index.unique,
            };

            return props;
        };


        const propertyDeclaration = ts.factory.createPropertyDeclaration(
            [
                ...(col.foreignKey ?
                    [ generateArrowDecorator(foreignKeyDecorator, [col.foreignKey.targetModel]) ]
                    : []
                ),
                generateObjectLiteralDecorator('Column', buildColumnDecoratorProps(col)),
                ...(col.indices && col.indices.length ?
                    col.indices.map(index =>
                        generateObjectLiteralDecorator('Index', buildIndexDecoratorProps(index)))
                    : []
                )
            ],
            col.name,
            (col.autoIncrement || col.allowNull || col.defaultValue !== undefined) ?
                ts.factory.createToken(ts.SyntaxKind.QuestionToken) : ts.factory.createToken(ts.SyntaxKind.ExclamationToken),
            buildColumnTypeNode(col, dialect),
            undefined,
        );

        return attachColumnCommentJsDoc(propertyDeclaration, col.comment);
    }

    /**
     * Build table class declaration
     * @param {ITableMetadata} tableMetadata
     * @param {Dialect} dialect
     * @param {boolean} strict
     */
    private static buildTableClassDeclaration(
        tableMetadata: ITableMetadata,
        dialect: Dialect,
        strict: boolean = true
    ): string {
        const { name, columns } = tableMetadata;

        let generatedCode = '';

        // Named imports from sequelize-typescript
        generatedCode += nodeToString(generateNamedImports(
            [
                ...DECORATORS_BASE_IMPORTS,
                ...new Set(tableMetadata.associations?.map(a => a.associationName)),
            ],
            'sequelize-typescript'
        ));

        generatedCode += '\n';

        // Named imports for associations
        const importModels = new Set<string>();

        // Add models for associations
        tableMetadata.associations?.forEach(a => {
            importModels.add(a.targetModel);
            a.joinModel && importModels.add(a.joinModel);
        });

        // Add models for foreign keys
        Object.values(tableMetadata.columns).forEach(col => {
            col.foreignKey && importModels.add(col.foreignKey.targetModel);
        });

        // A self-referencing model resolves its own name in the same file.
        importModels.delete(name);

        [...importModels].forEach(modelName => {
            generatedCode += nodeToString(generateNamedImports(
                [ modelName ],
                `./${modelName}`
            ));

            generatedCode += '\n';
        });

        // Type-only import of the shared Json type for JSON/JSONB columns.
        if (tableHasJsonColumn(tableMetadata)) {
            generatedCode += nodeToString(buildJsonTypeImport());
            generatedCode += '\n';
        }

        // Type-only import of the enum shared types the model uses.
        const enumTypesImport = buildEnumTypesImport(tableMetadata);

        if (enumTypesImport) {
            generatedCode += nodeToString(enumTypesImport);
            generatedCode += '\n';
        }

        const attributesInterfaceName = `${name}Attributes`;

        if (strict) {
            generatedCode += '\n';

            const attributesInterface = ts.factory.createInterfaceDeclaration(
                [
                    ts.factory.createToken(ts.SyntaxKind.ExportKeyword),
                ],
                ts.factory.createIdentifier(attributesInterfaceName),
                undefined,
                undefined,
                [
                    ...(Object.values(columns).map(c => attachColumnCommentJsDoc(
                        ts.factory.createPropertySignature(
                            undefined,
                            ts.factory.createIdentifier(c.name),
                            c.autoIncrement || c.allowNull || c.defaultValue !== undefined ?
                                ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                            buildColumnTypeNode(c, dialect)
                        ),
                        c.comment
                    )))
                ]
            );

            generatedCode += nodeToString(attributesInterface);
            generatedCode += '\n';
        }

        const classDecl = ts.factory.createClassDeclaration(
            [
                // @Table decorator
                generateObjectLiteralDecorator('Table', buildTableDecoratorProps(tableMetadata)),
                // Export modifier
                ts.factory.createToken(ts.SyntaxKind.ExportKeyword),
            ],
            name,
            undefined,
            !strict ? [
                ts.factory.createHeritageClause(
                    ts.SyntaxKind.ExtendsKeyword,
                    [
                        ts.factory.createExpressionWithTypeArguments(
                            ts.factory.createIdentifier('Model'),
                            []
                        )
                    ]
                )
            ] : [
                ts.factory.createHeritageClause(
                    ts.SyntaxKind.ExtendsKeyword,
                    [
                        ts.factory.createExpressionWithTypeArguments(
                            ts.factory.createIdentifier('Model'),
                            [
                                ts.factory.createTypeReferenceNode(
                                    ts.factory.createIdentifier(attributesInterfaceName),
                                    undefined
                                ),
                                ts.factory.createTypeReferenceNode(
                                    ts.factory.createIdentifier(attributesInterfaceName),
                                    undefined
                                )
                            ],
                        )
                    ]
                ),
                ts.factory.createHeritageClause(
                    ts.SyntaxKind.ImplementsKeyword,
                    [
                        ts.factory.createExpressionWithTypeArguments(
                            ts.factory.createIdentifier(attributesInterfaceName),
                            undefined
                        )
                    ]
                )
            ],
            // Class members
            [
                ...Object.values(columns).map(col => this.buildColumnPropertyDecl(col, dialect)),
                ...tableMetadata.associations && tableMetadata.associations.length ?
                    tableMetadata.associations.map(a => buildAssociationPropertyDecl(a)) : []
            ]
        );

        generatedCode += '\n';
        generatedCode += nodeToString(classDecl);

        return generatedCode;
    }

    /**
     * Build main index file
     * @param {ITableMetadata[]} tablesMetadata
     * @returns {string}
     */
    private static buildIndexExports(tablesMetadata: ITablesMetadata): string {
        return Object.values(tablesMetadata)
            .map(t =>  nodeToString(generateIndexExport(t.name)))
            .join('\n');
    }

    /**
     * Render the decorators output as one file per table, the shared type files the
     * models use, and the index barrel.
     * @param {ITablesMetadata} tablesMetadata
     * @param {Dialect} dialect
     * @param {boolean | undefined} strict
     * @returns {IGeneratedFile[]}
     */
    private static renderDecoratorsFiles(
        tablesMetadata: ITablesMetadata,
        dialect: Dialect,
        strict: boolean | undefined
    ): IGeneratedFile[] {
        const files: IGeneratedFile[] = Object.values(tablesMetadata).map(tableMetadata => ({
            fileName: `${tableMetadata.name}.ts`,
            content: ModelBuilder.buildTableClassDeclaration(tableMetadata, dialect, strict),
        }));

        if (tablesHaveJsonColumn(tablesMetadata)) {
            warnJsonSupportFileNameCollision(tablesMetadata);
            files.push({ fileName: JSON_SUPPORT_FILE_NAME, content: renderJsonSupportFile() });
        }

        if (tablesHaveSharedEnumType(tablesMetadata)) {
            warnEnumSupportFileNameCollision(tablesMetadata);
            files.push({ fileName: ENUM_SUPPORT_FILE_NAME, content: renderEnumSupportFile(tablesMetadata) });
        }

        files.push({ fileName: 'index.ts', content: ModelBuilder.buildIndexExports(tablesMetadata) });

        return files;
    }

    /**
     * Build models files using the given configuration and dialect
     * @returns {Promise<void>}
     */
    async build(): Promise<void> {
        const { clean, outDir } = this.config.output;
        const format = resolveFormat(this.config);

        if (this.config.connection.logging) {
            console.log('CONFIGURATION', this.config);
        }

        if (shouldNoticeIgnoredStrict(this.config)) {
            console.warn(STRICT_IGNORED_NOTICE);
        }

        const typeOverrides = await loadTypeOverrides(this.config.metadata);

        console.log(`Fetching metadata from source`);
        let tablesMetadata = await this.dialect.buildTablesMetadata(this.config);

        if (Object.keys(tablesMetadata).length === 0) {
            console.warn(`Couldn't find any table for database ${this.config.connection.database} and provided filters`);
            return;
        }

        if (typeOverrides) {
            const application = applyTypeOverrides(tablesMetadata, typeOverrides);
            tablesMetadata = application.tablesMetadata;
            warnUnmatchedTypeOverrides(application.unmatchedEntries);
        }

        tablesMetadata = assignSharedEnumTypeNames(
            tablesMetadata,
            collectReservedIdentifiers(tablesMetadata, this.dialect)
        );

        warnUnmappedTypes(tablesMetadata, this.dialect, format);

        // Check if output dir exists
        try {
            await fs.access(outDir);
        }
        catch(err: unknown) {
            if (isErrnoException(err) && err.code === 'ENOENT') {
                await fs.mkdir(outDir, { recursive: true });
            }
            else {
                throw new Error(`Failed to access output directory '${outDir}'`, { cause: err });
            }
        }

        // Clean files if required
        if (clean) {
            console.log(`Cleaning output dir`);
            for (const file of await fs.readdir(outDir)) {
                await fs.unlink(path.join(outDir, file));
            }
        }

        const files = format === 'native' ?
            renderNativeFiles(tablesMetadata, this.dialect) :
            ModelBuilder.renderDecoratorsFiles(tablesMetadata, this.dialect, this.config.strict);

        await writeGeneratedFiles(outDir, files);

        for (const file of files) {
            console.log(`Generated file at ${path.join(outDir, file.fileName)}`);
        }

        // Lint files
        try {
            let linter: Linter;

            if (this.config.lintOptions) {
                linter = new Linter(this.config.lintOptions);
            }
            else {
                linter = new Linter();
            }

            console.log(`Linting files`);
            await linter.lintFiles([path.join(outDir, '*.ts')]);
        }
        catch(err: unknown) {
            // Handle unsupported global eslint usage
            if (isErrnoException(err) && err.code === 'MODULE_NOT_FOUND') {
                let msg = `\n[WARNING] Linting models skipped: dependency not found.\n`;
                msg += `Linting models globally is not supported (eslint library does not support global plugins).\n`;
                msg += `If you have installed the library globally (--global flag) and you want to automatically lint your generated models,\n`;
                msg += `please install the following packages locally: npm install -S typescript eslint @typescript-eslint/parser\n`;

                console.warn(msg);
            }
            else {
                throw err;
            }
        }

        if (format === 'decorators') {
            warnWhenDecoratorsDependencyIsMissing(outDir);
        }
    }
}
