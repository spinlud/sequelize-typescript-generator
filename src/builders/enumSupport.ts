import * as ts from 'typescript';
import { pascalCase } from 'change-case';
import type { IColumnEnumType, IColumnMetadata, ITableMetadata, ITablesMetadata } from '../dialects/Dialect.js';
import { generateTypeOnlyImport, nodeToString } from './utils.js';

/**
 * Base name of the shared support file holding the enum shared types. A
 * collision with a model name is reported by `warnEnumSupportFileNameCollision`.
 */
export const ENUM_SUPPORT_FILE_BASENAME = 'enums';

/**
 * File name of the shared enum support file.
 */
export const ENUM_SUPPORT_FILE_NAME = `${ENUM_SUPPORT_FILE_BASENAME}.ts`;

/**
 * Sibling module specifier used by model files to import enum shared types.
 */
export const ENUM_SUPPORT_MODULE_SPECIFIER = `./${ENUM_SUPPORT_FILE_BASENAME}`;

/**
 * Suffix appended to an enum shared type name that clashes with a generated
 * model name or another identifier declared or imported by a model file.
 */
export const ENUM_RESERVED_NAME_SUFFIX = 'Enum';

/**
 * Prefix given to an enum shared type name that does not start with a valid
 * identifier character, e.g. a database name starting with a digit.
 */
const ENUM_INVALID_START_PREFIX = 'Enum';

/**
 * First numeric suffix given to clashing names that need a counter.
 */
const FIRST_NUMERIC_SUFFIX = 2;

/**
 * A database enum used by at least one generated column, with the identifier of
 * its shared type.
 */
export type ISharedEnumType = Pick<IColumnEnumType, 'schema' | 'name' | 'labels'> & {
    typeName: string;
};

/**
 * Unique key of a database enum type: its schema and name.
 * @param {Pick<IColumnEnumType, 'schema' | 'name'>} enumType
 * @returns {string}
 */
const buildEnumTypeKey = ({ schema, name }: Pick<IColumnEnumType, 'schema' | 'name'>): string =>
    JSON.stringify([schema, name]);

/**
 * Qualified database name of an enum type, e.g. `public.plan_tier`.
 * @param {Pick<IColumnEnumType, 'schema' | 'name'>} enumType
 * @returns {string}
 */
const formatEnumTypeName = ({ schema, name }: Pick<IColumnEnumType, 'schema' | 'name'>): string =>
    `${schema}.${name}`;

/**
 * Compare two strings by code point, independently of the locale.
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
const compareCodePoints = (left: string, right: string): number =>
    left < right ? -1 : left > right ? 1 : 0;

/**
 * Report whether a column is typed with an enum shared type: an enum column
 * whose TypeScript type no type override replaces.
 * @param {IColumnMetadata} column
 * @returns {boolean}
 */
export const columnUsesSharedEnumType = (column: IColumnMetadata): boolean =>
    column.enumType !== undefined && column.typeOverride?.tsType === undefined;

/**
 * Collect the database enums of every enum column, sorted by schema then name.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {IColumnEnumType[]}
 */
const collectEnumTypes = (tablesMetadata: ITablesMetadata): IColumnEnumType[] => {
    const enumTypes = new Map<string, IColumnEnumType>();

    for (const table of Object.values(tablesMetadata)) {
        for (const column of Object.values(table.columns)) {
            if (column.enumType) {
                enumTypes.set(buildEnumTypeKey(column.enumType), column.enumType);
            }
        }
    }

    return [...enumTypes.values()].sort((left, right) =>
        compareCodePoints(left.schema, right.schema) || compareCodePoints(left.name, right.name));
};

/**
 * Collect the keys of the database enums used by at least one column typed with
 * an enum shared type.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {Set<string>}
 */
const collectUsedEnumTypeKeys = (tablesMetadata: ITablesMetadata): Set<string> =>
    new Set(Object.values(tablesMetadata).flatMap(table =>
        Object.values(table.columns).flatMap(column =>
            column.enumType && columnUsesSharedEnumType(column) ? [buildEnumTypeKey(column.enumType)] : [])));

/**
 * Turn a database name into a Pascal-case identifier, dropping characters that
 * are not valid in an identifier and prefixing a name that does not start with
 * a valid identifier character.
 * @param {string} name
 * @returns {string}
 */
export const toPascalCaseIdentifier = (name: string): string => {
    const identifier = [...pascalCase(name)]
        .filter(character => ts.isIdentifierPart(character.codePointAt(0) ?? 0, ts.ScriptTarget.Latest))
        .join('');
    const firstCodePoint = identifier.codePointAt(0);

    return firstCodePoint !== undefined && ts.isIdentifierStart(firstCodePoint, ts.ScriptTarget.Latest)
        ? identifier
        : `${ENUM_INVALID_START_PREFIX}${identifier}`;
};

/**
 * Identifiers the shared enum type names must not take: the generated model
 * names and every other identifier a model file declares, imports or
 * references.
 */
export interface IReservedIdentifiers {
    modelNames: ReadonlySet<string>;
    nonModelIdentifiers: ReadonlySet<string>;
}

/**
 * A name clash resolved while naming the enum shared types, reported as a warning.
 */
interface IEnumNameClash {
    enumType: IColumnEnumType;
    baseName: string;
    typeName: string;
    reason: string;
}

/**
 * Resolve the shared type name of every enum. The name is the Pascal case of the
 * database type name. On a clash, only the clashing enums are renamed:
 * - an enum from a schema none of the generated tables belong to is prefixed
 *   with its Pascal-cased schema when another enum of the same name exists;
 * - a name equal to a generated model name or to another reserved identifier
 *   gets the `Enum` suffix;
 * - names still equal after that are disambiguated in code-point order of the
 *   database schema then type name: the first keeps the name, the next ones get
 *   the suffix 2, 3, and so on.
 * @param {IColumnEnumType[]} enumTypes Enums sorted by schema then name
 * @param {ReadonlySet<string>} tableSchemas
 * @param {IReservedIdentifiers} reserved
 * @returns {{ names: Map<string, string>; clashes: IEnumNameClash[] }}
 */
const resolveSharedEnumTypeNames = (
    enumTypes: IColumnEnumType[],
    tableSchemas: ReadonlySet<string>,
    reserved: IReservedIdentifiers
): { names: Map<string, string>; clashes: IEnumNameClash[] } => {
    const namedEnumTypes = enumTypes.map(enumType => ({
        enumType,
        baseName: toPascalCaseIdentifier(enumType.name),
    }));
    const schemasByBaseName = new Map<string, Set<string>>();

    for (const { enumType, baseName } of namedEnumTypes) {
        const schemas = schemasByBaseName.get(baseName) ?? new Set<string>();
        schemas.add(enumType.schema);
        schemasByBaseName.set(baseName, schemas);
    }

    const candidates = namedEnumTypes.map(({ enumType, baseName }) => {
        const isForeignSchemaClash = !tableSchemas.has(enumType.schema) &&
            (schemasByBaseName.get(baseName)?.size ?? 0) > 1;
        const schemaQualified = isForeignSchemaClash
            ? `${toPascalCaseIdentifier(enumType.schema)}${baseName}`
            : baseName;
        const isModelName = reserved.modelNames.has(schemaQualified);
        const isReserved = isModelName || reserved.nonModelIdentifiers.has(schemaQualified);

        return {
            enumType,
            baseName,
            candidate: isReserved ? `${schemaQualified}${ENUM_RESERVED_NAME_SUFFIX}` : schemaQualified,
            reasons: [
                ...isForeignSchemaClash ? [`an enum type of the same name in another schema`] : [],
                ...isModelName ? [`the model '${schemaQualified}'`] : [],
                ...isReserved && !isModelName ? [`the identifier '${schemaQualified}' used by the model files`] : [],
            ],
        };
    });

    const taken = new Set<string>([...reserved.modelNames, ...reserved.nonModelIdentifiers]);
    const typeNames = new Map<string, string>();

    // The first enum in order keeps a candidate name; the others sharing it are
    // suffixed once every unsuffixed name is taken, so a suffix never steals a
    // name another enum resolves to on its own.
    for (const { enumType, candidate } of candidates) {
        if (!taken.has(candidate)) {
            taken.add(candidate);
            typeNames.set(buildEnumTypeKey(enumType), candidate);
        }
    }

    for (const { enumType, candidate } of candidates) {
        if (!typeNames.has(buildEnumTypeKey(enumType))) {
            let suffix = FIRST_NUMERIC_SUFFIX;

            while (taken.has(`${candidate}${suffix}`)) {
                suffix++;
            }

            taken.add(`${candidate}${suffix}`);
            typeNames.set(buildEnumTypeKey(enumType), `${candidate}${suffix}`);
        }
    }

    const clashes: IEnumNameClash[] = [];

    for (const { enumType, baseName, candidate, reasons } of candidates) {
        const typeName = typeNames.get(buildEnumTypeKey(enumType)) ?? candidate;

        if (typeName === baseName) {
            continue;
        }

        const sharingEnums = candidates
            .filter(other => other.enumType !== enumType && other.candidate === candidate)
            .map(other => `'${formatEnumTypeName(other.enumType)}'`);
        const allReasons = typeName === candidate || sharingEnums.length === 0
            ? reasons
            : [...reasons, `the enum type ${sharingEnums.join(', ')}`];

        clashes.push({
            enumType,
            baseName,
            typeName,
            reason: allReasons.length > 0 ? allReasons.join(' and ') : `an identifier used by the model files`,
        });
    }

    return { names: typeNames, clashes };
};

/**
 * Build the warning for an enum whose shared type is renamed to avoid a name clash.
 * @param {IEnumNameClash} clash
 * @returns {string}
 */
const buildEnumNameClashWarning = ({ enumType, baseName, typeName, reason }: IEnumNameClash): string =>
    `Enum type '${formatEnumTypeName(enumType)}' is emitted as '${typeName}' instead of '${baseName}' ` +
    `to avoid a name clash with ${reason}.`;

/**
 * Name the enum shared types of the run and record each name on the columns
 * typed with it. Names are resolved over every database enum of the generated
 * columns, so a type override never renames another enum; an enum whose
 * TypeScript type a type override replaces on every column gets no shared type.
 * A warning is emitted for every renamed enum that has a shared type.
 * @param {ITablesMetadata} tablesMetadata
 * @param {IReservedIdentifiers} reserved
 * @returns {ITablesMetadata}
 */
export const assignSharedEnumTypeNames = (
    tablesMetadata: ITablesMetadata,
    reserved: IReservedIdentifiers
): ITablesMetadata => {
    const usedEnumTypeKeys = collectUsedEnumTypeKeys(tablesMetadata);

    if (usedEnumTypeKeys.size === 0) {
        return tablesMetadata;
    }

    const enumTypes = collectEnumTypes(tablesMetadata);

    const tableSchemas = new Set(Object.values(tablesMetadata)
        .map(table => table.schema)
        .filter(schema => schema !== undefined));
    const { names, clashes } = resolveSharedEnumTypeNames(enumTypes, tableSchemas, reserved);

    for (const clash of clashes.filter(({ enumType }) => usedEnumTypeKeys.has(buildEnumTypeKey(enumType)))) {
        console.warn('[WARNING]', buildEnumNameClashWarning(clash));
    }

    const named: ITablesMetadata = {};

    for (const [tableKey, table] of Object.entries(tablesMetadata)) {
        const columns: ITableMetadata['columns'] = {};

        for (const [columnKey, column] of Object.entries(table.columns)) {
            const sharedTypeName = column.enumType && columnUsesSharedEnumType(column)
                ? names.get(buildEnumTypeKey(column.enumType))
                : undefined;

            columns[columnKey] = column.enumType && sharedTypeName
                ? { ...column, enumType: { ...column.enumType, sharedTypeName } }
                : column;
        }

        named[tableKey] = { ...table, columns };
    }

    return named;
};

/**
 * Build the TypeScript type of an enum column: a reference to its shared type,
 * or the union of its labels when no shared type name is assigned, as an array
 * for an enum array column.
 * @param {IColumnEnumType} enumType
 * @returns {ts.TypeNode}
 */
export const buildEnumColumnTypeNode = (enumType: IColumnEnumType): ts.TypeNode => {
    const elementType = enumType.sharedTypeName
        ? ts.factory.createTypeReferenceNode(enumType.sharedTypeName, undefined)
        : buildEnumLabelsUnionTypeNode(enumType.labels);

    return enumType.isArray
        ? ts.factory.createArrayTypeNode(
            ts.isUnionTypeNode(elementType) ? ts.factory.createParenthesizedType(elementType) : elementType
        )
        : elementType;
};

/**
 * Build the union of string literal types of the enum labels, or `never` for
 * an enum without labels.
 * @param {string[]} labels
 * @returns {ts.TypeNode}
 */
const buildEnumLabelsUnionTypeNode = (labels: string[]): ts.TypeNode =>
    labels.length > 0
        ? ts.factory.createUnionTypeNode(labels.map(label =>
            ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(label))))
        : ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);

/**
 * Collect the enum shared types used by the columns of the given tables, sorted
 * by type name.
 * @param {ITableMetadata[]} tables
 * @returns {ISharedEnumType[]}
 */
const collectSharedEnumTypes = (tables: ITableMetadata[]): ISharedEnumType[] => {
    const sharedEnumTypes = new Map<string, ISharedEnumType>();

    for (const table of tables) {
        for (const column of Object.values(table.columns)) {
            const enumType = column.enumType;

            if (enumType?.sharedTypeName && columnUsesSharedEnumType(column)) {
                sharedEnumTypes.set(enumType.sharedTypeName, {
                    schema: enumType.schema,
                    name: enumType.name,
                    labels: enumType.labels,
                    typeName: enumType.sharedTypeName,
                });
            }
        }
    }

    return [...sharedEnumTypes.values()]
        .sort((left, right) => compareCodePoints(left.typeName, right.typeName));
};

/**
 * Report whether any table has a column typed with an enum shared type.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {boolean}
 */
export const tablesHaveSharedEnumType = (tablesMetadata: ITablesMetadata): boolean =>
    collectSharedEnumTypes(Object.values(tablesMetadata)).length > 0;

/**
 * Build the exported type alias of an enum shared type, e.g.
 * `export type PlanTier = "free" | "pro";`, with the labels in database order.
 * @param {ISharedEnumType} sharedEnumType
 * @returns {ts.TypeAliasDeclaration}
 */
export const buildSharedEnumTypeAliasDeclaration = (sharedEnumType: ISharedEnumType): ts.TypeAliasDeclaration =>
    ts.factory.createTypeAliasDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        sharedEnumType.typeName,
        undefined,
        buildEnumLabelsUnionTypeNode(sharedEnumType.labels)
    );

/**
 * Render the shared enum support file: one exported type alias per enum shared
 * type used by a generated column, sorted by type name.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {string}
 */
export const renderEnumSupportFile = (tablesMetadata: ITablesMetadata): string =>
    collectSharedEnumTypes(Object.values(tablesMetadata))
        .map(sharedEnumType => nodeToString(buildSharedEnumTypeAliasDeclaration(sharedEnumType)))
        .join('\n');

/**
 * Build the type-only import of the enum shared types a model uses, or
 * undefined when it uses none.
 * @param {ITableMetadata} table
 * @returns {ts.ImportDeclaration | undefined}
 */
export const buildEnumTypesImport = (table: ITableMetadata): ts.ImportDeclaration | undefined => {
    const typeNames = collectSharedEnumTypes([table]).map(sharedEnumType => sharedEnumType.typeName);

    return typeNames.length > 0
        ? generateTypeOnlyImport(typeNames, ENUM_SUPPORT_MODULE_SPECIFIER)
        : undefined;
};

/**
 * Warn when a generated model name collides with the shared enum support file
 * name, which would make both write to the same file.
 * @param {ITablesMetadata} tablesMetadata
 * @returns {void}
 */
export const warnEnumSupportFileNameCollision = (tablesMetadata: ITablesMetadata): void => {
    const collision = Object.values(tablesMetadata)
        .find(table => table.name === ENUM_SUPPORT_FILE_BASENAME)?.name;

    if (collision) {
        console.warn(
            '[WARNING]',
            `Model '${collision}' collides with the shared enum support file '${ENUM_SUPPORT_FILE_NAME}'; ` +
            `the generated model and the enum support file would overwrite each other.`
        );
    }
};
