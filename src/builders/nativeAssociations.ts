import pluralize from 'pluralize';
import { Model } from 'sequelize';
import type { BelongsToManyOptions, BelongsToOptions, HasManyOptions } from 'sequelize';
import type { ITableMetadata } from '../dialects/Dialect.js';
import type { IAssociationMetadata } from '../dialects/AssociationsParser.js';
import { resolveAssociationPropertyName } from './ModelBuilder.js';
import { classifyAttribute, resolvePrimaryKeyAttribute } from './nativeAttributes.js';

/**
 * Sequelize association method for each association kind.
 */
export const ASSOCIATION_METHODS = {
    HasOne: 'hasOne',
    HasMany: 'hasMany',
    BelongsTo: 'belongsTo',
    BelongsToMany: 'belongsToMany',
} as const satisfies Record<IAssociationMetadata['associationName'], keyof typeof Model>;

export type AssociationMethod = typeof ASSOCIATION_METHODS[keyof typeof ASSOCIATION_METHODS];

/**
 * Options emitted on a native association call, in output order:
 * as, through, foreignKey, otherKey, targetKey, sourceKey, onDelete, onUpdate.
 */
export type AssociationWiringOptions =
    Partial<Pick<BelongsToOptions, 'as' | 'foreignKey' | 'targetKey' | 'onDelete' | 'onUpdate'>>
    & Partial<Pick<HasManyOptions, 'sourceKey'>>
    & Partial<Pick<BelongsToManyOptions, 'otherKey'>>
    & { throughModel?: string };

/**
 * A resolved association call for the wiring file.
 */
export interface INativeAssociationWiring {
    sourceModel: string;
    targetModel: string;
    method: AssociationMethod;
    options: AssociationWiringOptions;
}

/**
 * Report whether an association exposes a collection on the source model.
 * @param {IAssociationMetadata} association
 * @returns {boolean}
 */
export const isToManyAssociation = (association: IAssociationMetadata): boolean =>
    association.associationName.includes('Many');

/**
 * Find the model field name of the single-column foreign key on a table whose
 * constraint points at the given target model.
 * @param {ITableMetadata} table
 * @param {string} targetModel
 * @returns {string | undefined}
 */
const findForeignKeyColumnTargeting = (table: ITableMetadata, targetModel: string): string | undefined => {
    for (const column of Object.values(table.columns)) {
        if (column.foreignKey && column.foreignKey.targetModel === targetModel) {
            return column.name;
        }
    }

    return undefined;
};

/**
 * Resolve the foreign key column of an association. A discovered association
 * carries it directly; a file-defined one is resolved from the constraint that
 * connects the two models, on the side that holds the foreign key.
 * @param {ITableMetadata} source
 * @param {IAssociationMetadata} association
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {string | undefined}
 */
export const resolveAssociationForeignKey = (
    source: ITableMetadata,
    association: IAssociationMetadata,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): string | undefined => {
    if (association.foreignKey) {
        return association.foreignKey;
    }

    const { associationName, targetModel, joinModel } = association;

    if (associationName === 'BelongsTo') {
        return findForeignKeyColumnTargeting(source, targetModel);
    }

    if (associationName === 'HasOne' || associationName === 'HasMany') {
        const target = tablesByModel.get(targetModel);

        return target && findForeignKeyColumnTargeting(target, source.name);
    }

    const junction = joinModel ? tablesByModel.get(joinModel) : undefined;

    return junction && findForeignKeyColumnTargeting(junction, source.name);
};

/**
 * Resolve the other key of a many-to-many association: the junction foreign key
 * pointing at the target model.
 * @param {IAssociationMetadata} association
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {string | undefined}
 */
const resolveAssociationOtherKey = (
    association: IAssociationMetadata,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): string | undefined => {
    if (association.associationName !== 'BelongsToMany') {
        return undefined;
    }

    const junction = association.joinModel ? tablesByModel.get(association.joinModel) : undefined;

    return junction && findForeignKeyColumnTargeting(junction, association.targetModel);
};

/**
 * Resolve the target key of an association: the explicit target key, otherwise,
 * for a BelongsTo, the target key of the source foreign key column.
 * @param {ITableMetadata} source
 * @param {IAssociationMetadata} association
 * @returns {string | undefined}
 */
const resolveAssociationTargetKey = (
    source: ITableMetadata,
    association: IAssociationMetadata
): string | undefined => {
    if (association.targetKey) {
        return association.targetKey;
    }

    if (association.associationName !== 'BelongsTo') {
        return undefined;
    }

    for (const column of Object.values(source.columns)) {
        if (column.foreignKey && column.foreignKey.targetModel === association.targetModel) {
            return column.foreignKey.targetKey;
        }
    }

    return undefined;
};

/**
 * Resolve the complete wiring for an association call: source and target model,
 * Sequelize method, and options in output order.
 * @param {ITableMetadata} source
 * @param {IAssociationMetadata} association
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {INativeAssociationWiring}
 */
export const resolveAssociationWiring = (
    source: ITableMetadata,
    association: IAssociationMetadata,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): INativeAssociationWiring => {
    const alias = resolveAssociationPropertyName(association);
    const foreignKey = resolveAssociationForeignKey(source, association, tablesByModel);
    const otherKey = resolveAssociationOtherKey(association, tablesByModel);
    const targetKey = resolveAssociationTargetKey(source, association);

    const options: AssociationWiringOptions = {
        as: alias,
        ...association.joinModel && { throughModel: association.joinModel },
        ...foreignKey && { foreignKey },
        ...otherKey && { otherKey },
        ...targetKey && { targetKey },
        ...association.sourceKey && { sourceKey: association.sourceKey },
        ...association.onDelete && { onDelete: association.onDelete },
        ...association.onUpdate && { onUpdate: association.onUpdate },
    };

    return {
        sourceModel: source.name,
        targetModel: association.targetModel,
        method: ASSOCIATION_METHODS[association.associationName],
        options,
    };
};

/**
 * A type argument of an association mixin. `model` is a bare model reference,
 * `attribute` an indexed access (`model["attr"]`), `literal` a string literal
 * type and `number` the fallback primary key type.
 */
export type MixinTypeArgument =
    { kind: 'model'; name: string }
    | { kind: 'attribute'; model: string; attribute: string }
    | { kind: 'literal'; value: string }
    | { kind: 'number' };

/**
 * A mixin member declaration on a model class.
 */
export interface IMixinDeclaration {
    propertyName: string;
    mixinTypeName: string;
    typeArguments: MixinTypeArgument[];
}

/**
 * Uppercase the first character of a name.
 * @param {string} value
 * @returns {string}
 */
const upperFirst = (value: string): string =>
    value.length ? value[0].toUpperCase() + value.slice(1) : value;

/**
 * Build the primary key type argument of a mixin. When the target has a single
 * primary key it is an indexed access; otherwise it falls back to `number`.
 * @param {string} targetModel
 * @param {string | undefined} targetPrimaryKeyAttribute
 * @returns {MixinTypeArgument}
 */
const buildPrimaryKeyTypeArgument = (
    targetModel: string,
    targetPrimaryKeyAttribute: string | undefined
): MixinTypeArgument =>
    targetPrimaryKeyAttribute
        ? { kind: 'attribute', model: targetModel, attribute: targetPrimaryKeyAttribute }
        : { kind: 'number' };

/**
 * Build the mixin member declarations an association contributes to its source
 * model. To-one associations expose get/set/create; to-many associations expose
 * the full get/set/add/remove/has/count/create set.
 * @param {IAssociationMetadata} association
 * @param {string} alias
 * @param {string | undefined} targetPrimaryKeyAttribute
 * @param {string | undefined} foreignKeyAttribute
 * @returns {IMixinDeclaration[]}
 */
export const buildAssociationMixinDeclarations = (
    association: IAssociationMetadata,
    alias: string,
    targetPrimaryKeyAttribute: string | undefined,
    foreignKeyAttribute: string | undefined
): IMixinDeclaration[] => {
    const { associationName, targetModel } = association;
    const modelArgument: MixinTypeArgument = { kind: 'model', name: targetModel };
    const primaryKeyArgument = buildPrimaryKeyTypeArgument(targetModel, targetPrimaryKeyAttribute);
    const pluralName = upperFirst(alias);
    const singularName = upperFirst(pluralize.singular(alias));

    if (associationName === 'BelongsTo' || associationName === 'HasOne') {
        const prefix = associationName === 'BelongsTo' ? 'BelongsTo' : 'HasOne';

        return [
            {
                propertyName: `get${pluralName}`,
                mixinTypeName: `${prefix}GetAssociationMixin`,
                typeArguments: [modelArgument],
            },
            {
                propertyName: `set${pluralName}`,
                mixinTypeName: `${prefix}SetAssociationMixin`,
                typeArguments: [modelArgument, primaryKeyArgument],
            },
            {
                propertyName: `create${pluralName}`,
                mixinTypeName: `${prefix}CreateAssociationMixin`,
                typeArguments: [modelArgument],
            },
        ];
    }

    const prefix = associationName === 'HasMany' ? 'HasMany' : 'BelongsToMany';
    const createArguments: MixinTypeArgument[] = associationName === 'HasMany'
        ? foreignKeyAttribute
            ? [modelArgument, { kind: 'literal', value: foreignKeyAttribute }]
            : [modelArgument]
        : [modelArgument];

    return [
        {
            propertyName: `get${pluralName}`,
            mixinTypeName: `${prefix}GetAssociationsMixin`,
            typeArguments: [modelArgument],
        },
        {
            propertyName: `set${pluralName}`,
            mixinTypeName: `${prefix}SetAssociationsMixin`,
            typeArguments: [modelArgument, primaryKeyArgument],
        },
        {
            propertyName: `add${singularName}`,
            mixinTypeName: `${prefix}AddAssociationMixin`,
            typeArguments: [modelArgument, primaryKeyArgument],
        },
        {
            propertyName: `add${pluralName}`,
            mixinTypeName: `${prefix}AddAssociationsMixin`,
            typeArguments: [modelArgument, primaryKeyArgument],
        },
        {
            propertyName: `remove${singularName}`,
            mixinTypeName: `${prefix}RemoveAssociationMixin`,
            typeArguments: [modelArgument, primaryKeyArgument],
        },
        {
            propertyName: `remove${pluralName}`,
            mixinTypeName: `${prefix}RemoveAssociationsMixin`,
            typeArguments: [modelArgument, primaryKeyArgument],
        },
        {
            propertyName: `has${singularName}`,
            mixinTypeName: `${prefix}HasAssociationMixin`,
            typeArguments: [modelArgument, primaryKeyArgument],
        },
        {
            propertyName: `has${pluralName}`,
            mixinTypeName: `${prefix}HasAssociationsMixin`,
            typeArguments: [modelArgument, primaryKeyArgument],
        },
        {
            propertyName: `count${pluralName}`,
            mixinTypeName: `${prefix}CountAssociationsMixin`,
            typeArguments: [],
        },
        {
            propertyName: `create${singularName}`,
            mixinTypeName: `${prefix}CreateAssociationMixin`,
            typeArguments: createArguments,
        },
    ];
};

/**
 * Base named imports from `sequelize` every native model file needs.
 */
const BASE_SEQUELIZE_IMPORTS = [
    'DataTypes',
    'InferAttributes',
    'InferCreationAttributes',
    'Model',
    'Sequelize',
] as const;

/**
 * Collect the named imports a native model file needs from `sequelize`: the base
 * set, the brands its attributes use, and every association mixin type. The
 * result is sorted for deterministic output.
 * @param {ITableMetadata} table
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {string[]}
 */
export const collectSequelizeImports = (
    table: ITableMetadata,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): string[] => {
    const imports = new Set<string>(BASE_SEQUELIZE_IMPORTS);

    for (const column of Object.values(table.columns)) {
        const targetModel = column.foreignKey?.targetModel;
        const isForeignKeyTargetGenerated = targetModel !== undefined && tablesByModel.has(targetModel);
        const kind = classifyAttribute(column, table, isForeignKeyTargetGenerated);

        if (kind === 'foreignKey' || kind === 'foreignKeyNullable') {
            imports.add('ForeignKey');
        }
        else if (kind === 'creationOptional' || kind === 'creationOptionalNullable') {
            imports.add('CreationOptional');
        }
    }

    if (table.timestamps) {
        imports.add('CreationOptional');
    }

    const associations = table.associations ?? [];

    if (associations.length) {
        imports.add('Association');
        imports.add('NonAttribute');

        for (const association of associations) {
            const target = tablesByModel.get(association.targetModel);
            const alias = resolveAssociationPropertyName(association);
            const targetPrimaryKeyAttribute = target && resolvePrimaryKeyAttribute(target);
            const foreignKeyAttribute = resolveAssociationForeignKey(table, association, tablesByModel);

            for (const mixin of buildAssociationMixinDeclarations(
                association,
                alias,
                targetPrimaryKeyAttribute,
                foreignKeyAttribute
            )) {
                imports.add(mixin.mixinTypeName);
            }
        }
    }

    return [...imports].sort();
};

/**
 * Collect the model names a native model file imports as types: foreign key
 * targets and association targets, excluding the model itself and any
 * non-generated model. The result is sorted for deterministic output.
 * @param {ITableMetadata} table
 * @param {ReadonlyMap<string, ITableMetadata>} tablesByModel
 * @returns {string[]}
 */
export const collectModelTypeImports = (
    table: ITableMetadata,
    tablesByModel: ReadonlyMap<string, ITableMetadata>
): string[] => {
    const imports = new Set<string>();
    const selfName = table.name;

    for (const column of Object.values(table.columns)) {
        const targetModel = column.foreignKey?.targetModel;

        if (targetModel !== undefined && targetModel !== selfName && tablesByModel.has(targetModel)) {
            imports.add(targetModel);
        }
    }

    for (const association of table.associations ?? []) {
        const { targetModel } = association;

        if (targetModel !== selfName && tablesByModel.has(targetModel)) {
            imports.add(targetModel);
        }
    }

    return [...imports].sort();
};
