import pluralize from 'pluralize';
import {
    INativeTableMetadata,
    INativeColumnMetadata,
    INativeAssociationMetadata,
} from './fixture';

// Metadata interpretation shared by both emitters. Only pure descriptors live here;
// each emitter is responsible for turning these descriptors into source text so that
// the comparison isolates the code-emitting style (compiler API vs template literals).

const JS_BASE_TYPE: { [dbType: string]: string } = {
    INTEGER: 'number',
    VARCHAR: 'string',
    TIMESTAMP: 'Date',
};

export type AttributeKind = 'creationOptional' | 'foreignKey' | 'nullable' | 'plain';

/**
 * Map a database column type to its TypeScript base type.
 */
export const mapToJsBaseType = (col: INativeColumnMetadata): string => {
    return JS_BASE_TYPE[col.type] ?? 'unknown';
};

/**
 * Classify how a column attribute must be typed on the model class.
 * Foreign keys are branded, autoincrement PKs and columns with defaults are creation
 * optional, nullable columns become a `T | null` union, everything else is plain.
 */
export const classifyAttribute = (col: INativeColumnMetadata): AttributeKind => {
    if (col.foreignKey) {
        return 'foreignKey';
    }
    if (col.autoIncrement || col.defaultValue !== undefined) {
        return 'creationOptional';
    }
    if (col.allowNull) {
        return 'nullable';
    }
    return 'plain';
};

export interface MixinDescriptor {
    methodName: string;
    mixinType: string;
    typeArguments: string[];
}

/**
 * Capitalize the first character of a value.
 */
const upperFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Association alias used both for the `as` option and for deriving mixin method names.
 * Plural for to-many associations, singular for to-one associations.
 */
export const associationAlias = (assoc: INativeAssociationMetadata): string => {
    const singular = pluralize.singular(assoc.targetModel).toLowerCase();
    return assoc.associationName.includes('Many') ? pluralize.plural(singular) : singular;
};

/**
 * Build the list of association mixin methods to declare on the model class.
 */
export const buildAssociationMixins = (assoc: INativeAssociationMetadata): MixinDescriptor[] => {
    const target = assoc.targetModel;
    const singular = upperFirst(pluralize.singular(associationAlias(assoc)));
    const plural = upperFirst(pluralize.plural(associationAlias(assoc)));

    if (assoc.associationName === 'HasMany') {
        return [
            { methodName: `get${plural}`, mixinType: 'HasManyGetAssociationsMixin', typeArguments: [target] },
            { methodName: `set${plural}`, mixinType: 'HasManySetAssociationsMixin', typeArguments: [target, 'number'] },
            { methodName: `add${singular}`, mixinType: 'HasManyAddAssociationMixin', typeArguments: [target, 'number'] },
            { methodName: `add${plural}`, mixinType: 'HasManyAddAssociationsMixin', typeArguments: [target, 'number'] },
            { methodName: `remove${singular}`, mixinType: 'HasManyRemoveAssociationMixin', typeArguments: [target, 'number'] },
            { methodName: `remove${plural}`, mixinType: 'HasManyRemoveAssociationsMixin', typeArguments: [target, 'number'] },
            { methodName: `has${singular}`, mixinType: 'HasManyHasAssociationMixin', typeArguments: [target, 'number'] },
            { methodName: `has${plural}`, mixinType: 'HasManyHasAssociationsMixin', typeArguments: [target, 'number'] },
            { methodName: `count${plural}`, mixinType: 'HasManyCountAssociationsMixin', typeArguments: [] },
            { methodName: `create${singular}`, mixinType: 'HasManyCreateAssociationMixin', typeArguments: [target] },
        ];
    }

    if (assoc.associationName === 'HasOne') {
        return [
            { methodName: `get${singular}`, mixinType: 'HasOneGetAssociationMixin', typeArguments: [target] },
            { methodName: `set${singular}`, mixinType: 'HasOneSetAssociationMixin', typeArguments: [target, 'number'] },
            { methodName: `create${singular}`, mixinType: 'HasOneCreateAssociationMixin', typeArguments: [target] },
        ];
    }

    // BelongsTo
    return [
        { methodName: `get${singular}`, mixinType: 'BelongsToGetAssociationMixin', typeArguments: [target] },
        { methodName: `set${singular}`, mixinType: 'BelongsToSetAssociationMixin', typeArguments: [target, 'number'] },
        { methodName: `create${singular}`, mixinType: 'BelongsToCreateAssociationMixin', typeArguments: [target] },
    ];
};

/**
 * Whether the association exposes a to-many included property (array) or a to-one property.
 */
export const isToManyAssociation = (assoc: INativeAssociationMetadata): boolean =>
    assoc.associationName.includes('Many');

export interface IndexDescriptor {
    name: string;
    unique: boolean;
    fields: string[];
}

/**
 * Collect model-level indexes by grouping per-column index metadata by index name.
 */
export const buildIndexes = (table: INativeTableMetadata): IndexDescriptor[] => {
    const byName = new Map<string, IndexDescriptor>();

    for (const col of Object.values(table.columns)) {
        for (const index of col.indices ?? []) {
            const existing = byName.get(index.name);
            if (existing) {
                existing.fields.push(col.originName);
            }
            else {
                byName.set(index.name, {
                    name: index.name,
                    unique: index.unique ?? false,
                    fields: [col.originName],
                });
            }
        }
    }

    return [...byName.values()];
};

/**
 * Compute the sorted list of named imports from `sequelize` for a model file.
 */
export const collectSequelizeImports = (table: INativeTableMetadata): string[] => {
    const names = new Set<string>([
        'DataTypes',
        'InferAttributes',
        'InferCreationAttributes',
        'Model',
        'Sequelize',
    ]);

    for (const col of Object.values(table.columns)) {
        const kind = classifyAttribute(col);
        if (kind === 'creationOptional') {
            names.add('CreationOptional');
        }
        if (kind === 'foreignKey') {
            names.add('ForeignKey');
        }
    }

    for (const assoc of table.associations ?? []) {
        names.add('Association');
        names.add('NonAttribute');
        for (const mixin of buildAssociationMixins(assoc)) {
            names.add(mixin.mixinType);
        }
    }

    return [...names].sort();
};

/**
 * Model names imported for associations and foreign keys (one import per model file).
 */
export const collectModelImports = (table: INativeTableMetadata): string[] => {
    const models = new Set<string>();

    for (const assoc of table.associations ?? []) {
        models.add(assoc.targetModel);
    }
    for (const col of Object.values(table.columns)) {
        if (col.foreignKey) {
            models.add(col.foreignKey.targetModel);
        }
    }

    return [...models].sort();
};
