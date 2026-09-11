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
import { isErrnoException } from '../utils/errors.js';
import { Builder } from './Builder.js';
import { resolveAssociationPropertyName } from './associationNaming.js';
import { IGeneratedFile, renderNativeFiles, writeGeneratedFiles } from './generatedFile.js';
import { warnWhenDecoratorsDependencyIsMissing } from './decoratorsDependency.js';
import {
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

export { resolveAssociationPropertyName } from './associationNaming.js';

const foreignKeyDecorator = 'ForeignKey';

/**
 * Build the TypeScript type node of a column: the shared `Json` type for a JSON
 * column, otherwise the dialect JS mapping.
 * @param {IColumnMetadata} col
 * @param {Dialect} dialect
 * @returns {ts.TypeNode}
 */
const buildColumnTypeNode = (col: IColumnMetadata, dialect: Dialect): ts.TypeNode =>
    col.isJson
        ? createGenericTypeReference(JSON_TYPE_NAME, [])
        : createTypeNodeFromName(dialect.mapDbTypeToJs(col.type) ?? 'any');

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

        const buildColumnDecoratorProps = (col: IColumnMetadata): Partial<ModelAttributeColumnOptions> => {
            const props: Partial<ModelAttributeColumnOptions> = {
                ...col.originName && col.name !== col.originName && { field: col.originName },
                ...col.primaryKey && { primaryKey: col.primaryKey },
                ...col.autoIncrement && { autoIncrement: col.autoIncrement },
                ...col.allowNull && { allowNull: col.allowNull },
                ...col.dataType && { type: col.dataType },
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


        return ts.factory.createPropertyDeclaration(
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
                'Model',
                'Table',
                'Column',
                'DataType',
                'Index',
                'Sequelize',
                foreignKeyDecorator,
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
                    ...(Object.values(columns).map(c => ts.factory.createPropertySignature(
                        undefined,
                        ts.factory.createIdentifier(c.name),
                        c.autoIncrement || c.allowNull || c.defaultValue !== undefined ?
                            ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                        buildColumnTypeNode(c, dialect)
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
     * Render the decorators output as one file per table plus the index barrel.
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

        console.log(`Fetching metadata from source`);
        const tablesMetadata = await this.dialect.buildTablesMetadata(this.config);

        if (Object.keys(tablesMetadata).length === 0) {
            console.warn(`Couldn't find any table for database ${this.config.connection.database} and provided filters`);
            return;
        }

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
