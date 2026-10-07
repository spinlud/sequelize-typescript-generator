import { promises as fs } from 'fs';
import * as ts from 'typescript';
import type { IConfigMetadata } from '../config/IConfig.js';
import { isSequelizeDataTypeKey } from '../dialects/dataTypes.js';
import type { DataTypeArgument, ISequelizeDataType } from '../dialects/dataTypes.js';

/**
 * Prefix of every type overrides validation error message.
 */
export const VALIDATION_ERROR_PREFIX = '[ValidationError]';

/**
 * Section of the type overrides file an entry belongs to.
 */
export type TypeOverrideSection = 'types' | 'columns';

const TYPE_OVERRIDE_SECTIONS: readonly TypeOverrideSection[] = ['types', 'columns'];

const TYPE_OVERRIDE_FIELDS: readonly string[] = ['tsType', 'dataType'];

/**
 * Allowed number of dot-separated key segments per section: `<type>` or
 * `<schema>.<type>`; `<table>.<column>` or `<schema>.<table>.<column>`.
 */
const KEY_SEGMENT_RANGE_BY_SECTION = {
    types: { min: 1, max: 2 },
    columns: { min: 2, max: 3 },
} satisfies Record<TypeOverrideSection, { min: number; max: number }>;

/**
 * Namespaces accepted as a prefix of a data type identifier.
 */
const DATA_TYPE_PREFIXES: readonly string[] = ['DataTypes', 'DataType'];

/**
 * Name of the type alias the TypeScript type text is parsed into.
 */
const TS_TYPE_ALIAS_NAME = '__TypeOverride';

/**
 * A validated type override entry.
 */
export interface IParsedTypeOverride {
    section: TypeOverrideSection;
    key: string; // Key as written in the type overrides
    tsType?: ts.TypeNode; // Synthesized node, safe to print into any source file
    dataType?: ISequelizeDataType;
}

/**
 * Validated type overrides, indexed by section and by lower-cased key.
 */
export interface IParsedTypeOverrides {
    types: ReadonlyMap<string, IParsedTypeOverride>;
    columns: ReadonlyMap<string, IParsedTypeOverride>;
}

/**
 * Build a type overrides validation error.
 * @param {string} message
 * @returns {Error}
 */
const validationError = (message: string): Error => new Error(`${VALIDATION_ERROR_PREFIX} Type overrides: ${message}`);

/**
 * Label of a type override entry used in messages, e.g. `columns["users.status"]`.
 * @param {TypeOverrideSection} section
 * @param {string} key
 * @returns {string}
 */
export const formatTypeOverrideLabel = (section: TypeOverrideSection, key: string): string =>
    `${section}[${JSON.stringify(key)}]`;

/**
 * Type guard for a plain JSON object (not null, not an array).
 * @param {unknown} value
 * @returns {boolean}
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Report the syntactic diagnostics of a source text.
 * @param {string} text
 * @returns {boolean}
 */
const hasSyntaxErrors = (text: string): boolean => {
    const { diagnostics } = ts.transpileModule(text, { reportDiagnostics: true });

    return (diagnostics ?? []).some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
};

/**
 * Parse a source text into its statements, or undefined when it has syntax errors.
 * @param {string} text
 * @returns {ts.NodeArray<ts.Statement> | undefined}
 */
const parseStatements = (text: string): ts.NodeArray<ts.Statement> | undefined => {
    if (hasSyntaxErrors(text)) {
        return undefined;
    }

    return ts.createSourceFile('typeOverride.ts', text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS).statements;
};

/**
 * Detach a parsed node and all its descendants from their source text by giving
 * them synthesized positions, so the printer renders them from the nodes alone in
 * any source file.
 * @param {T} node
 * @returns {T}
 */
const synthesizeNode = <T extends ts.Node>(node: T): T => {
    ts.forEachChild(node, child => {
        synthesizeNode(child);
    });

    return ts.setTextRange(node, { pos: -1, end: -1 });
};

/**
 * Parse the TypeScript type text of an override into a type node.
 * @param {string} text
 * @param {string} label
 * @returns {ts.TypeNode}
 */
const parseTsType = (text: string, label: string): ts.TypeNode => {
    const fail = (): Error => validationError(`${label}.tsType is not a valid TypeScript type: ${JSON.stringify(text)}`);

    if (text.trim() === '') {
        throw fail();
    }

    const statements = parseStatements(`type ${TS_TYPE_ALIAS_NAME} = ${text};`);

    if (!statements || statements.length !== 1) {
        throw fail();
    }

    const [statement] = statements;

    if (!ts.isTypeAliasDeclaration(statement)) {
        throw fail();
    }

    return synthesizeNode(statement.type);
};

/**
 * Resolve the DataTypes key named by an identifier or a `DataTypes.`/`DataType.`
 * property access, or undefined for any other expression.
 * @param {ts.Expression} expression
 * @returns {string | undefined}
 */
const resolveDataTypeName = (expression: ts.Expression): string | undefined => {
    if (ts.isIdentifier(expression)) {
        return expression.text;
    }

    if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        DATA_TYPE_PREFIXES.includes(expression.expression.text) &&
        ts.isIdentifier(expression.name)
    ) {
        return expression.name.text;
    }

    return undefined;
};

/**
 * Convert an accepted data type expression into a format-neutral data type.
 * @param {ts.Expression} expression
 * @param {(reason: string) => Error} fail
 * @returns {ISequelizeDataType}
 */
const convertDataTypeExpression = (
    expression: ts.Expression,
    fail: (reason: string) => Error
): ISequelizeDataType => {
    const callee = ts.isCallExpression(expression) ? expression.expression : expression;
    const name = resolveDataTypeName(callee);

    if (name === undefined) {
        throw fail('only data type identifiers, calls, and string or number literals are allowed');
    }

    if (!isSequelizeDataTypeKey(name)) {
        throw fail(`unknown data type ${JSON.stringify(name)}`);
    }

    if (!ts.isCallExpression(expression)) {
        return { key: name, args: [] };
    }

    if (expression.typeArguments || expression.questionDotToken) {
        throw fail('only data type identifiers, calls, and string or number literals are allowed');
    }

    const args: DataTypeArgument[] = expression.arguments.map(argument => {
        if (ts.isStringLiteral(argument)) {
            return argument.text;
        }

        if (ts.isNumericLiteral(argument)) {
            return Number(argument.text);
        }

        return convertDataTypeExpression(argument, fail);
    });

    return { key: name, args };
};

/**
 * Parse the Sequelize data type expression of an override.
 * @param {string} text
 * @param {string} label
 * @returns {ISequelizeDataType}
 */
const parseDataType = (text: string, label: string): ISequelizeDataType => {
    const fail = (reason: string): Error =>
        validationError(`${label}.dataType ${JSON.stringify(text)} is not a valid data type expression: ${reason}`);

    const statements = parseStatements(text);

    if (!statements) {
        throw fail('it does not parse');
    }

    if (statements.length !== 1) {
        throw fail('expected a single expression');
    }

    const [statement] = statements;

    if (!ts.isExpressionStatement(statement)) {
        throw fail('expected a single expression');
    }

    return convertDataTypeExpression(statement.expression, fail);
};

/**
 * Validate the key of an entry and return its lower-cased matching form.
 * @param {TypeOverrideSection} section
 * @param {string} key
 * @returns {string}
 */
const normalizeKey = (section: TypeOverrideSection, key: string): string => {
    const segments = key.split('.');
    const { min, max } = KEY_SEGMENT_RANGE_BY_SECTION[section];
    const expected = section === 'types'
        ? '"<type>" or "<schema>.<type>"'
        : '"<table>.<column>" or "<schema>.<table>.<column>"';

    if (segments.length < min || segments.length > max || segments.some(segment => segment.trim() === '')) {
        throw validationError(`${formatTypeOverrideLabel(section, key)} has a malformed key: expected ${expected}`);
    }

    return segments.join('.').toLowerCase();
};

/**
 * Validate one entry of a section.
 * @param {TypeOverrideSection} section
 * @param {string} key
 * @param {unknown} entry
 * @returns {IParsedTypeOverride}
 */
const parseEntry = (section: TypeOverrideSection, key: string, entry: unknown): IParsedTypeOverride => {
    const label = formatTypeOverrideLabel(section, key);

    if (!isPlainObject(entry)) {
        throw validationError(`${label} must be an object`);
    }

    const unknownField = Object.keys(entry).find(field => !TYPE_OVERRIDE_FIELDS.includes(field));

    if (unknownField !== undefined) {
        throw validationError(`${label} has an unknown field ${JSON.stringify(unknownField)}: expected tsType or dataType`);
    }

    const { tsType, dataType } = entry;

    if (tsType === undefined && dataType === undefined) {
        throw validationError(`${label} must set tsType, dataType or both`);
    }

    if (tsType !== undefined && typeof tsType !== 'string') {
        throw validationError(`${label}.tsType must be a string`);
    }

    if (dataType !== undefined && typeof dataType !== 'string') {
        throw validationError(`${label}.dataType must be a string`);
    }

    return {
        section,
        key,
        ...tsType !== undefined && { tsType: parseTsType(tsType, label) },
        ...dataType !== undefined && { dataType: parseDataType(dataType, label) },
    };
};

/**
 * Validate one section and index its entries by lower-cased key.
 * @param {TypeOverrideSection} section
 * @param {unknown} value
 * @returns {Map<string, IParsedTypeOverride>}
 */
const parseSection = (section: TypeOverrideSection, value: unknown): Map<string, IParsedTypeOverride> => {
    const entries = new Map<string, IParsedTypeOverride>();

    if (value === undefined) {
        return entries;
    }

    if (!isPlainObject(value)) {
        throw validationError(`${section} must be an object`);
    }

    for (const [key, entry] of Object.entries(value)) {
        const normalizedKey = normalizeKey(section, key);
        const existing = entries.get(normalizedKey);

        if (existing) {
            throw validationError(
                `${formatTypeOverrideLabel(section, key)} is a duplicate of ` +
                `${formatTypeOverrideLabel(section, existing.key)}: keys match case-insensitively`
            );
        }

        entries.set(normalizedKey, parseEntry(section, key, entry));
    }

    return entries;
};

/**
 * Validate type overrides of unknown shape.
 * @param {unknown} value
 * @returns {IParsedTypeOverrides}
 */
export const parseTypeOverrides = (value: unknown): IParsedTypeOverrides => {
    if (!isPlainObject(value)) {
        throw validationError('the root must be an object with optional "types" and "columns" sections');
    }

    const unknownSection = Object.keys(value).find(key => !TYPE_OVERRIDE_SECTIONS.some(section => section === key));

    if (unknownSection !== undefined) {
        throw validationError(`unknown section ${JSON.stringify(unknownSection)}: expected "types" or "columns"`);
    }

    return {
        types: parseSection('types', value.types),
        columns: parseSection('columns', value.columns),
    };
};

/**
 * Read and parse the JSON content of a type overrides file.
 * @param {string} filePath
 * @returns {Promise<unknown>}
 */
const readTypeOverridesFile = async (filePath: string): Promise<unknown> => {
    let content: string;

    try {
        content = await fs.readFile(filePath, 'utf8');
    }
    catch (err: unknown) {
        throw new Error(`${VALIDATION_ERROR_PREFIX} Type overrides file '${filePath}' cannot be read`, { cause: err });
    }

    try {
        const parsed: unknown = JSON.parse(content);

        return parsed;
    }
    catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);

        throw new Error(`${VALIDATION_ERROR_PREFIX} Type overrides file '${filePath}' is not valid JSON: ${reason}`, { cause: err });
    }
};

/**
 * Load and validate the type overrides configured in the metadata options, from
 * either the type overrides file or the programmatic `typeOverrides`. Returns
 * undefined when neither is set.
 * @param {IConfigMetadata | undefined} metadata
 * @returns {Promise<IParsedTypeOverrides | undefined>}
 */
export const loadTypeOverrides = async (
    metadata: IConfigMetadata | undefined
): Promise<IParsedTypeOverrides | undefined> => {
    const filePath = metadata?.typeOverridesFile;
    const typeOverrides: unknown = metadata?.typeOverrides;

    if (filePath !== undefined && typeOverrides !== undefined) {
        throw new Error(
            `${VALIDATION_ERROR_PREFIX} Set either typeOverridesFile or typeOverrides, not both`
        );
    }

    if (filePath !== undefined) {
        return parseTypeOverrides(await readTypeOverridesFile(filePath));
    }

    if (typeOverrides !== undefined) {
        return parseTypeOverrides(typeOverrides);
    }

    return undefined;
};
