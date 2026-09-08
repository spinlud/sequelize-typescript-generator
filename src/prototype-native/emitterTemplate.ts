import {
    INativeTableMetadata,
    INativeColumnMetadata,
    INativeAssociationMetadata,
} from './fixture';
import {
    classifyAttribute,
    mapToJsBaseType,
    buildAssociationMixins,
    associationAlias,
    isToManyAssociation,
    buildIndexes,
    collectSequelizeImports,
    collectModelImports,
} from './shared';

// Emits the same native Sequelize v6 models as emitterFactory.ts, but by building strings
// with plain per-section functions (no template engine). Output must be byte-for-byte
// identical to the compiler-API emitter so the two can be diffed. Indentation is four
// spaces per level and string literals use double quotes to match the TypeScript printer.

const INDENT = '    ';
const indent = (level: number): string => INDENT.repeat(level);

/**
 * Build the attribute type text for a column according to its classification.
 */
const buildAttributeType = (col: INativeColumnMetadata): string => {
    const base = mapToJsBaseType(col);

    switch (classifyAttribute(col)) {
        case 'creationOptional':
            return `CreationOptional<${base}>`;
        case 'foreignKey':
            return `ForeignKey<${col.foreignKey!.targetModel}["${col.foreignKey!.targetKey}"]>`;
        case 'nullable':
            return `${base} | null`;
        default:
            return base;
    }
};

/**
 * Build the `declare` class fields for column attributes.
 */
const buildColumnFields = (table: INativeTableMetadata): string[] => {
    return Object.values(table.columns).map(col =>
        `${indent(1)}declare ${col.name}: ${buildAttributeType(col)};`
    );
};

/**
 * Build the `declare` association mixin fields.
 */
const buildMixinFields = (assoc: INativeAssociationMetadata): string[] => {
    return buildAssociationMixins(assoc).map(mixin => {
        const args = mixin.typeArguments.length ? `<${mixin.typeArguments.join(', ')}>` : '';
        return `${indent(1)}declare ${mixin.methodName}: ${mixin.mixinType}${args};`;
    });
};

/**
 * Build the optional included-association field.
 */
const buildIncludedField = (assoc: INativeAssociationMetadata): string => {
    const inner = isToManyAssociation(assoc) ? `${assoc.targetModel}[]` : assoc.targetModel;
    return `${indent(1)}declare ${associationAlias(assoc)}?: NonAttribute<${inner}>;`;
};

/**
 * Build the `declare static associations` block.
 */
const buildStaticAssociations = (
    table: INativeTableMetadata,
    associations: INativeAssociationMetadata[]
): string[] => {
    const lines = [`${indent(1)}declare static associations: {`];
    for (const assoc of associations) {
        lines.push(`${indent(2)}${associationAlias(assoc)}: Association<${table.name}, ${assoc.targetModel}>;`);
    }
    lines.push(`${indent(1)}};`);
    return lines;
};

/**
 * Build one column's options object lines for Model.init at the given base indent level.
 */
const buildColumnInitOptions = (col: INativeColumnMetadata, level: number): string[] => {
    const entries: string[] = [`type: ${col.dataType}`];

    if (col.primaryKey) {
        entries.push('primaryKey: true');
    }
    if (col.autoIncrement) {
        entries.push('autoIncrement: true');
    }
    if (!col.primaryKey) {
        entries.push(`allowNull: ${col.allowNull ? 'true' : 'false'}`);
    }
    if (col.name !== col.originName) {
        entries.push(`field: "${col.originName}"`);
    }

    const lines: string[] = [];
    entries.forEach((entry, i) => {
        const isLast = i === entries.length - 1 && !col.foreignKey;
        lines.push(`${indent(level + 1)}${entry}${isLast ? '' : ','}`);
    });

    if (col.foreignKey) {
        lines.push(`${indent(level + 1)}references: {`);
        lines.push(`${indent(level + 2)}model: "${col.foreignKey.targetTable}",`);
        lines.push(`${indent(level + 2)}key: "${col.foreignKey.targetKey}"`);
        lines.push(`${indent(level + 1)}}`);
    }

    return lines;
};

/**
 * Build the model options object lines (second argument of Model.init).
 */
const buildModelInitOptions = (table: INativeTableMetadata, level: number): string[] => {
    const indexes = buildIndexes(table);
    const lines: string[] = [
        `${indent(level + 1)}sequelize,`,
        `${indent(level + 1)}tableName: "${table.originName}",`,
        `${indent(level + 1)}timestamps: ${table.timestamps ? 'true' : 'false'}${indexes.length ? ',' : ''}`,
    ];

    if (indexes.length) {
        lines.push(`${indent(level + 1)}indexes: [`);
        indexes.forEach((index, i) => {
            const isLastIndex = i === indexes.length - 1;
            lines.push(`${indent(level + 2)}{`);
            lines.push(`${indent(level + 3)}name: "${index.name}",`);
            if (index.unique) {
                lines.push(`${indent(level + 3)}unique: true,`);
            }
            const fields = index.fields.map(f => `"${f}"`).join(', ');
            lines.push(`${indent(level + 3)}fields: [${fields}]`);
            lines.push(`${indent(level + 2)}}${isLastIndex ? '' : ','}`);
        });
        lines.push(`${indent(level + 1)}]`);
    }

    return lines;
};

/**
 * Build the `static initModel` method lines.
 */
const buildInitModelMethod = (table: INativeTableMetadata): string[] => {
    const lines: string[] = [
        `${indent(1)}static initModel(sequelize: Sequelize): typeof ${table.name} {`,
        `${indent(2)}${table.name}.init({`,
    ];

    const columns = Object.values(table.columns);
    columns.forEach((col, i) => {
        const isLast = i === columns.length - 1;
        lines.push(`${indent(3)}${col.name}: {`);
        lines.push(...buildColumnInitOptions(col, 3));
        lines.push(`${indent(3)}}${isLast ? '' : ','}`);
    });

    lines.push(`${indent(2)}}, {`);
    lines.push(...buildModelInitOptions(table, 2));
    lines.push(`${indent(2)}});`);
    lines.push(`${indent(2)}return ${table.name};`);
    lines.push(`${indent(1)}}`);

    return lines;
};

/**
 * Emit the source text for a single model file.
 */
export const emitModelFile = (table: INativeTableMetadata): string => {
    const associations = table.associations ?? [];

    let code = `import { ${collectSequelizeImports(table).join(', ')} } from "sequelize";\n`;
    for (const modelName of collectModelImports(table)) {
        code += `import { ${modelName} } from "./${modelName}";\n`;
    }
    code += '\n';

    const body: string[] = [...buildColumnFields(table)];
    for (const assoc of associations) {
        body.push(...buildMixinFields(assoc));
    }
    for (const assoc of associations) {
        body.push(buildIncludedField(assoc));
    }
    if (associations.length) {
        body.push(...buildStaticAssociations(table, associations));
    }
    body.push(...buildInitModelMethod(table));

    code += `export class ${table.name} extends Model<InferAttributes<${table.name}>, InferCreationAttributes<${table.name}>> {\n`;
    code += body.map(line => `${line}\n`).join('');
    code += '}\n';

    return code;
};

/**
 * Emit the wiring file: inits every model, wires associations, returns them.
 */
export const emitInitModelsFile = (tables: INativeTableMetadata[]): string => {
    let code = `import { Sequelize } from "sequelize";\n`;
    for (const table of tables) {
        code += `import { ${table.name} } from "./${table.name}";\n`;
    }
    code += '\n';

    const lines: string[] = [`export function initModels(sequelize: Sequelize) {`];

    for (const table of tables) {
        lines.push(`${indent(1)}${table.name}.initModel(sequelize);`);
    }

    for (const table of tables) {
        for (const assoc of table.associations ?? []) {
            const method = assoc.associationName.charAt(0).toLowerCase() + assoc.associationName.slice(1);
            const options: string[] = [];
            if (assoc.associationName === 'BelongsTo') {
                options.push(`${indent(2)}targetKey: "${assoc.targetKey}",`);
            }
            else if (assoc.sourceKey) {
                options.push(`${indent(2)}sourceKey: "${assoc.sourceKey}",`);
            }
            options.push(`${indent(2)}foreignKey: "${assoc.foreignKey}",`);
            options.push(`${indent(2)}as: "${associationAlias(assoc)}"`);

            lines.push(`${indent(1)}${table.name}.${method}(${assoc.targetModel}, {`);
            lines.push(...options);
            lines.push(`${indent(1)}});`);
        }
    }

    lines.push(`${indent(1)}return {`);
    tables.forEach((table, i) => {
        const isLast = i === tables.length - 1;
        lines.push(`${indent(2)}${table.name}${isLast ? '' : ','}`);
    });
    lines.push(`${indent(1)}};`);
    lines.push('}');

    code += lines.map(line => `${line}\n`).join('');

    return code;
};
