import { promises as fs } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import { lintFiles } from '../lint';
import { ModelAttributeColumnOptions } from 'sequelize';
import { IConfig } from '../config';
import { IColumnMetadata, ITableMetadata, Dialect } from '../dialects/Dialect';
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

    private buildColumnPropertyDecl(col: IColumnMetadata, dataTypeMap: { [key: string]: string }): ts.PropertyDeclaration {
        const props: Partial<ModelAttributeColumnOptions> = {
            ...col.primaryKey && { primaryKey: col.primaryKey },
            ...col.autoIncrement && { autoIncrement: col.autoIncrement },
            ...col.allowNull && { allowNull: col.allowNull },
            type: col.dataType,
        };

        return ts.createProperty(
            [
                generateObjectLiteralDecorator('Column', props),
            ],
            undefined,
            col.name,
            (col.autoIncrement || col.allowNull) ?
                ts.createToken(ts.SyntaxKind.QuestionToken) : ts.createToken(ts.SyntaxKind.ExclamationToken),
            ts.createTypeReferenceNode(dataTypeMap[col.type] ?? 'any', undefined),
            undefined
        );
    }

    /**
     *
     * @param tableMetadata
     */
    private buildTableClassDeclaration(tableMetadata: ITableMetadata): string {
        const { name: tableName, columns } = tableMetadata;

        const classDecl = ts.createClassDeclaration(
            [
                // @Table decorator
                generateObjectLiteralDecorator('Table', {
                    tableName: tableName,
                    timestamps: tableMetadata.timestamps,
                    comment: tableMetadata.comment,
                })
            ],
            [
                ts.createToken(ts.SyntaxKind.ExportKeyword),
            ],
            tableName,
            undefined,
            [
                ts.createHeritageClause(
                    ts.SyntaxKind.ExtendsKeyword,
                    [
                        ts.createExpressionWithTypeArguments(
                            [ ts.createTypeReferenceNode(tableName, undefined) ],
                            ts.createIdentifier('Model')
                        )
                    ]

                )
            ],
            // Columns members
            columns.map(col => this.buildColumnPropertyDecl(col, this.dialect.jsDataTypesMap))
        );

        let generatedCode = '';

        generatedCode += nodeToString(generateNamedImports(
            [
                'Model',
                'Table',
                'Column',
                'DataType'
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
            console.warn(`Couldn't find any table for database ${this.config.connection.database}`);
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
                const outPath = path.join(outDir, tableMetadata.name + '.ts');

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
        lintFiles([path.join(outDir, '*.ts')]);
    }
}
