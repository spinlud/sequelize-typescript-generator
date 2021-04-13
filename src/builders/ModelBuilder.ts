import { promises as fs } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import pluralize from 'pluralize';
import { Linter } from '../lint';
import { ModelAttributeColumnOptions } from 'sequelize';
import { IndexOptions, IndexFieldOptions } from 'sequelize-typescript';
import { IConfig } from '../config';
import {IColumnMetadata, ITableMetadata, IIndexMetadata, Dialect, ITablesMetadata} from '../dialects/Dialect';
import { IAssociationMetadata } from '../dialects/AssociationsParser';
import { Builder } from './Builder';
import {
    nodeToString,
    generateArrowDecorator,
    generateNamedImports,
    generateObjectLiteralDecorator,
    generateIndexExport,
} from './utils';

const foreignKeyDecorator = 'ForeignKey';

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
                ...col.defaultValue && { defaultValue: col.defaultValue },
                ...col.onUpdate && { onUpdate: col.onUpdate },
                ...col.onDelete && { onDelete: col.onDelete },
                // @TODO fix this by creating a typescript definition for model
                // ...col.references && { references: col.references as ModelAttributeColumnReferencesOptions },
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


        return ts.createProperty(
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
            undefined,
            col.name,
            (col.autoIncrement || col.allowNull) ?
                ts.createToken(ts.SyntaxKind.QuestionToken) : ts.createToken(ts.SyntaxKind.ExclamationToken),
            ts.createTypeReferenceNode(dialect.mapDbTypeToJs(col.type) ?? 'any', undefined),
            undefined
        );
    }

    /**
     * Build association class member
     * @param {IAssociationMetadata} association
     */
    private static buildAssociationPropertyDecl(association: IAssociationMetadata): ts.PropertyDeclaration {
        const { associationName, targetModel, joinModel } = association;

        const targetModels = [ targetModel ];
        joinModel && targetModels.push(joinModel);

        return ts.createProperty(
            [
                ...(association.sourceKey ?
                        [
                            generateArrowDecorator(
                                associationName,
                                targetModels,
                                { sourceKey: association.sourceKey }
                            )
                        ]
                        : [
                            generateArrowDecorator(associationName, targetModels)
                        ]
                ),
            ],
            undefined,
            associationName.includes('Many') ?
                pluralize.plural(targetModel) : pluralize.singular(targetModel),
            ts.createToken(ts.SyntaxKind.QuestionToken),
            associationName.includes('Many') ?
                ts.createArrayTypeNode(ts.createTypeReferenceNode(targetModel, undefined)) :
                ts.createTypeReferenceNode(targetModel, undefined),
            undefined
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
        const { originName: tableName, name, columns } = tableMetadata;

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
        generatedCode += nodeToString(generateNamedImports(
            [
                'Deferrable',
            ],
            'sequelize'
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

        [...importModels].forEach(modelName => {
            generatedCode += nodeToString(generateNamedImports(
                [ modelName ],
                `./${modelName}`
            ));

            generatedCode += '\n';
        });

        const attributesInterfaceName = `${name}Attributes`;

        if (strict) {
            generatedCode += '\n';

            const attributesInterface = ts.createInterfaceDeclaration(
                undefined,
                undefined,
                ts.createIdentifier(attributesInterfaceName),
                undefined,
                undefined,
                [
                    ...(Object.values(columns).map(c => ts.createPropertySignature(
                        undefined,
                        ts.createIdentifier(c.name),
                        c.autoIncrement || c.allowNull ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                        ts.createTypeReferenceNode(dialect.mapDbTypeToJs(c.type) ?? 'any', undefined)
                    )))
                ]
            );

            generatedCode += nodeToString(attributesInterface);
            generatedCode += '\n';
        }

        const classDecl = ts.createClassDeclaration(
            [
                // @Table decorator
                generateObjectLiteralDecorator('Table', {
                    tableName: tableName,
                    ...tableMetadata.schema && { schema: tableMetadata.schema },
                    timestamps: tableMetadata.timestamps,
                    ...tableMetadata.comment && { comment: tableMetadata.comment },
                })
            ],
            [
                ts.createToken(ts.SyntaxKind.ExportKeyword),
            ],
            name,
            undefined,
            !strict ? [
                ts.createHeritageClause(
                    ts.SyntaxKind.ExtendsKeyword,
                    [
                        ts.createExpressionWithTypeArguments(
                            [],
                            ts.createIdentifier('Model')
                        )
                    ]
                )
            ] : [
                ts.createHeritageClause(
                    ts.SyntaxKind.ExtendsKeyword,
                    [
                        ts.createExpressionWithTypeArguments(
                            [
                                ts.createTypeReferenceNode(
                                    ts.createIdentifier(attributesInterfaceName),
                                    undefined
                                ),
                                ts.createTypeReferenceNode(
                                    ts.createIdentifier(attributesInterfaceName),
                                    undefined
                                )
                            ],
                            ts.createIdentifier('Model')
                        )
                    ]
                ),
                ts.createHeritageClause(
                    ts.SyntaxKind.ImplementsKeyword,
                    [
                        ts.createExpressionWithTypeArguments(
                            undefined,
                            ts.createIdentifier(attributesInterfaceName)
                        )
                    ]
                )
            ],
            // Class members
            [
                ...Object.values(columns).map(col => this.buildColumnPropertyDecl(col, dialect)),
                ...tableMetadata.associations && tableMetadata.associations.length ?
                    tableMetadata.associations.map(a => this.buildAssociationPropertyDecl(a)) : []
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
     * Build models files using the given configuration and dialect
     * @returns {Promise<void>}
     */
    async build(): Promise<void> {
        const { clean, outDir } = this.config.output;
        const writePromises: Promise<void>[] = [];

        if (this.config.connection.logging) {
            console.log('CONFIGURATION', this.config);
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
        catch(err) {
            if (err.code && err.code === 'ENOENT') {
                await fs.mkdir(outDir, { recursive: true });
            }
            else {
                console.error(err);
                process.exit(1);
            }
        }

        // Clean files if required
        if (clean) {
            console.log(`Cleaning output dir`);
            for (const file of await fs.readdir(outDir)) {
                await fs.unlink(path.join(outDir, file));
            }
        }

        // Build model files
        for (const tableMetadata of Object.values(tablesMetadata)) {
            console.log(`Processing table ${tableMetadata.originName}`);
            const tableClassDecl =
                ModelBuilder.buildTableClassDeclaration(tableMetadata, this.dialect, this.config.strict);

            writePromises.push((async () => {
                const outPath = path.join(outDir, `${tableMetadata.name}.ts`);

                await fs.writeFile(
                    outPath,
                    tableClassDecl,
                    { flag: 'w' }
                );

                console.log(`Generated model file at ${outPath}`);
            })());
        }

        // Build index file
        writePromises.push((async () => {
            const indexPath = path.join(outDir, 'index.ts');
            const indexContent = ModelBuilder.buildIndexExports(tablesMetadata);

            await fs.writeFile(
                indexPath,
                indexContent
            );

            console.log(`Generated index file at ${indexPath}`);
        })());

        await Promise.all(writePromises);

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
            linter.lintFiles([path.join(outDir, '*.ts')]);
        }
        catch(err) {
            // Handle unsupported global eslint usage
            if (err.code && err.code === 'MODULE_NOT_FOUND') {
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

    }
}
