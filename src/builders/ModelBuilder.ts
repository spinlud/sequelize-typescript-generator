import { promises as fs } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import { Linter } from '../lint';
import { ModelAttributeColumnOptions } from 'sequelize';
import { IndexOptions, IndexFieldOptions } from 'sequelize-typescript';
import { IConfig } from '../config';
import { IColumnMetadata, ITableMetadata, IIndexMetadata, Dialect } from '../dialects/Dialect';
import { generateNamedImports, generateObjectLiteralDecorator, nodeToString } from './utils';
import { Builder } from './Builder';

/**
 * @class ModelGenerator
 * @constructor
 * @param {Dialect} dialect
 */
export class ModelBuilder extends Builder {
    constructor(config: IConfig, dialect: Dialect) {
        super(config, dialect);
    }

    private buildColumnPropertyDecl(col: IColumnMetadata, dialect: Dialect): ts.PropertyDeclaration {

        const buildColumnDecoratorProps = (col: IColumnMetadata): Partial<ModelAttributeColumnOptions> => {
            const props: Partial<ModelAttributeColumnOptions> = {
                ...col.fieldName && { field: col.fieldName },
                ...col.primaryKey && { primaryKey: col.primaryKey },
                ...col.autoIncrement && { autoIncrement: col.autoIncrement },
                ...col.allowNull && { allowNull: col.allowNull },
                ...col.dataType && { type: col.dataType },
            };

            return props;
        }

        const buildIndexDecoratorProps = (index: IIndexMetadata): Partial<IndexOptions & IndexFieldOptions> => {
            const props: Partial<IndexOptions & IndexFieldOptions> = {
                name: index.name,
                ...index.using && { using: index.using },
                ...index.collation && { order: index.collation === 'A' ? 'ASC' : 'DESC' },
                unique: index.unique,
            };

            return props;
        }


        return ts.createProperty(
            [
                generateObjectLiteralDecorator('Column', buildColumnDecoratorProps(col)),
                ...(col.indices && col.indices.length ?
                    col.indices.map(index => generateObjectLiteralDecorator('Index', buildIndexDecoratorProps(index))) :
                    []
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
     *
     * @param tableMetadata
     */
    private buildTableClassDeclaration(tableMetadata: ITableMetadata): string {
        const { name: tableName, modelName, columns } = tableMetadata;

        const classDecl = ts.createClassDeclaration(
            [
                // @Table decorator
                generateObjectLiteralDecorator('Table', {
                    tableName: tableName,
                    ...tableMetadata.schema && { schema: tableMetadata.schema },
                    timestamps: tableMetadata.timestamps,
                    comment: tableMetadata.comment,
                })
            ],
            [
                ts.createToken(ts.SyntaxKind.ExportKeyword),
            ],
            modelName,
            undefined,
            [
                ts.createHeritageClause(
                    ts.SyntaxKind.ExtendsKeyword,
                    [
                        ts.createExpressionWithTypeArguments(
                            [ ts.createTypeReferenceNode(modelName, undefined) ],
                            ts.createIdentifier('Model')
                        )
                    ]

                )
            ],
            // Columns members
            columns.map(col => this.buildColumnPropertyDecl(col, this.dialect))
        );

        let generatedCode = '';

        generatedCode += nodeToString(generateNamedImports(
            [
                'Model',
                'Table',
                'Column',
                'DataType',
                'Index'
            ],
            'sequelize-typescript'
        ));

        generatedCode += '\n';

        generatedCode += nodeToString(classDecl);

        return generatedCode;
    }

    /**
     * Build models files with the given configuration and dialect
     * @returns {Promise<void>}
     */
    async build(): Promise<void> {
        const { clean, outDir } = this.config.output;
        const writePromises: Promise<void>[] = [];
        const tablesMetadata = await this.dialect.fetchMetadata(this.config);

        if (tablesMetadata.length === 0) {
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
            for (const file of await fs.readdir(outDir)) {
                await fs.unlink(path.join(outDir, file));
            }
        }

        // Build files
        for (const tableMetadata of tablesMetadata) {
            const tableClassDecl = this.buildTableClassDeclaration(tableMetadata);

            writePromises.push((async () => {
                const outPath = path.join(outDir, tableMetadata.modelName + '.ts');

                await fs.writeFile(
                    outPath,
                    tableClassDecl,
                    { flag: 'w' }
                );

                console.log(`Generated file ${outPath}`);
            })());
        }

        await Promise.all(writePromises);

        // Lint files
        let linter: Linter;

        if (this.config.lint) {
            linter = new Linter(this.config.lint);
        }
        else {
            linter = new Linter();
        }

        linter.lintFiles([path.join(outDir, '*.ts')]);
    }
}
