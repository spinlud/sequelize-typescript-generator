import {
    nodeToString,
    generateNamedImports,
    generateTypeOnlyImport,
    isTsExpression,
    createPropertyValueExpression,
    buildObjectLiteralExpression,
    createTypeNodeFromName,
    createNullableTypeNode,
    createGenericTypeReference,
    createIndexedAccessTypeNode,
    buildDataTypeExpression,
} from '../../builders/utils.js';
import * as ts from 'typescript';
import { renderDataTypeExpression, DATA_TYPE_NAMESPACES, ISequelizeDataType } from '../../dialects/dataTypes.js';
import {
    buildTableDecoratorProps,
    resolveAssociationPropertyName,
    buildAssociationDecoratorProps,
    buildAssociationPropertyDecl,
} from '../../builders/ModelBuilder.js';
import { ITableMetadata } from '../../dialects/Dialect.js';
import { IAssociationMetadata } from '../../dialects/AssociationsParser.js';

describe('buildTableDecoratorProps', () => {
    const baseTableMetadata: ITableMetadata = {
        name: 'Users',
        originName: 'users',
        timestamps: false,
        columns: {},
    };

    it('emits tableName and timestamps for a plain table', () => {
        expect(buildTableDecoratorProps(baseTableMetadata)).toEqual({
            tableName: 'users',
            timestamps: false,
        });
    });

    it('emits the schema when present', () => {
        const props = buildTableDecoratorProps({ ...baseTableMetadata, schema: 'dbo' });

        expect(props).toEqual({
            tableName: 'users',
            schema: 'dbo',
            timestamps: false,
        });
        expect(Object.keys(props)).toEqual(['tableName', 'schema', 'timestamps']);
    });

    it('emits hasTrigger right after timestamps when the table has a trigger', () => {
        const props = buildTableDecoratorProps({ ...baseTableMetadata, hasTrigger: true });

        expect(props).toEqual({
            tableName: 'users',
            timestamps: false,
            hasTrigger: true,
        });
        expect(Object.keys(props)).toEqual(['tableName', 'timestamps', 'hasTrigger']);
    });

    it('omits hasTrigger when the table has no trigger', () => {
        expect(buildTableDecoratorProps({ ...baseTableMetadata, hasTrigger: false }))
            .not.toHaveProperty('hasTrigger');
    });

    it('emits paranoid and deletedAt right after timestamps and before hasTrigger', () => {
        const props = buildTableDecoratorProps({
            ...baseTableMetadata,
            timestamps: true,
            paranoid: true,
            deletedAt: 'deleted_at',
            hasTrigger: true,
        });

        expect(props).toEqual({
            tableName: 'users',
            timestamps: true,
            paranoid: true,
            deletedAt: 'deleted_at',
            hasTrigger: true,
        });
        expect(Object.keys(props)).toEqual(['tableName', 'timestamps', 'paranoid', 'deletedAt', 'hasTrigger']);
    });

    it('omits paranoid and deletedAt when paranoid is not set', () => {
        const props = buildTableDecoratorProps(baseTableMetadata);

        expect(props).not.toHaveProperty('paranoid');
        expect(props).not.toHaveProperty('deletedAt');
    });
});

describe('resolveAssociationPropertyName', () => {
    it('uses the discovered alias when present', () => {
        const association: IAssociationMetadata = {
            associationName: 'HasMany',
            targetModel: 'employees',
            alias: 'managerEmployees',
        };

        expect(resolveAssociationPropertyName(association)).toBe('managerEmployees');
    });

    it('pluralizes the target model for a to-many association without alias', () => {
        const association: IAssociationMetadata = {
            associationName: 'HasMany',
            targetModel: 'unit',
        };

        expect(resolveAssociationPropertyName(association)).toBe('units');
    });

    it('singularizes the target model for BelongsTo and HasOne without alias', () => {
        const belongsTo: IAssociationMetadata = { associationName: 'BelongsTo', targetModel: 'races' };
        const hasOne: IAssociationMetadata = { associationName: 'HasOne', targetModel: 'profiles' };

        expect(resolveAssociationPropertyName(belongsTo)).toBe('race');
        expect(resolveAssociationPropertyName(hasOne)).toBe('profile');
    });
});

describe('buildAssociationDecoratorProps', () => {
    it('emits keys in the order as, foreignKey, targetKey, sourceKey, onDelete, onUpdate', () => {
        const association: IAssociationMetadata = {
            associationName: 'HasOne',
            targetModel: 'profiles',
            alias: 'profile',
            foreignKey: 'person_id',
            targetKey: 'person_id',
            sourceKey: 'person_id',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        };

        const props = buildAssociationDecoratorProps(association);

        expect(Object.keys(props!)).toEqual([
            'as', 'foreignKey', 'targetKey', 'sourceKey', 'onDelete', 'onUpdate',
        ]);
    });

    it('omits as when the association has no alias', () => {
        const association: IAssociationMetadata = {
            associationName: 'HasMany',
            targetModel: 'units',
            sourceKey: 'race_id',
        };

        const props = buildAssociationDecoratorProps(association);

        expect(props).toEqual({ sourceKey: 'race_id' });
        expect(props).not.toHaveProperty('as');
    });

    it('returns undefined when no option applies', () => {
        const association: IAssociationMetadata = { associationName: 'BelongsTo', targetModel: 'person' };

        expect(buildAssociationDecoratorProps(association)).toBeUndefined();
    });
});

describe('buildAssociationPropertyDecl', () => {
    it('renders a discovered BelongsTo property declaration', () => {
        const association: IAssociationMetadata = {
            associationName: 'BelongsTo',
            targetModel: 'person',
            alias: 'person',
            foreignKey: 'person_id',
            targetKey: 'person_id',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        };

        expect(nodeToString(buildAssociationPropertyDecl(association))).toBe(
            '@BelongsTo(() => person, { as: "person", foreignKey: "person_id", targetKey: "person_id", onDelete: "CASCADE", onUpdate: "CASCADE" })\n' +
            'person?: person;'
        );
    });

    it('renders a discovered HasOne property declaration', () => {
        const association: IAssociationMetadata = {
            associationName: 'HasOne',
            targetModel: 'profiles',
            alias: 'profile',
            foreignKey: 'person_id',
            sourceKey: 'person_id',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        };

        expect(nodeToString(buildAssociationPropertyDecl(association))).toBe(
            '@HasOne(() => profiles, { as: "profile", foreignKey: "person_id", sourceKey: "person_id", onDelete: "CASCADE", onUpdate: "CASCADE" })\n' +
            'profile?: profiles;'
        );
    });

    it('renders a discovered HasMany property declaration', () => {
        const association: IAssociationMetadata = {
            associationName: 'HasMany',
            targetModel: 'employees',
            alias: 'managerEmployees',
            foreignKey: 'manager_id',
            sourceKey: 'employee_id',
            onDelete: 'SET NULL',
        };

        expect(nodeToString(buildAssociationPropertyDecl(association))).toBe(
            '@HasMany(() => employees, { as: "managerEmployees", foreignKey: "manager_id", sourceKey: "employee_id", onDelete: "SET NULL" })\n' +
            'managerEmployees?: employees[];'
        );
    });

    it('renders an associations-file HasMany without alias as before', () => {
        const association: IAssociationMetadata = {
            associationName: 'HasMany',
            targetModel: 'units',
            sourceKey: 'race_id',
        };

        expect(nodeToString(buildAssociationPropertyDecl(association))).toBe(
            '@HasMany(() => units, { sourceKey: "race_id" })\n' +
            'units?: units[];'
        );
    });
});

describe('Builder utils', () => {

    describe('named imports', () => {
        it('should generate single import statement', () => {
            const importsSpecifier = 'Token1';
            const moduleSpecifier = `some-module`;
            const expected = `import { ${importsSpecifier} } from "${moduleSpecifier}";`;
            const generated = nodeToString(generateNamedImports([importsSpecifier], moduleSpecifier));

            expect(generated).toBe(expected);
        });

        it('should generate multiple named imports statement', () => {
            const importsSpecifiers = ['Token1', 'Token2', 'Token3'];
            const moduleSpecifier = `some-module`;
            const expected = `import { ${importsSpecifiers.join(`, `)} } from "${moduleSpecifier}";`;
            const generated = nodeToString(generateNamedImports(importsSpecifiers, moduleSpecifier));

            expect(generated).toBe(expected);
        });
    });

    describe('generateTypeOnlyImport', () => {
        it('generates a type-only named import', () => {
            expect(nodeToString(generateTypeOnlyImport(['races'], './races')))
                .toBe('import type { races } from "./races";');
        });

        it('generates a type-only import with several specifiers', () => {
            expect(nodeToString(generateTypeOnlyImport(['authors', 'books'], './models')))
                .toBe('import type { authors, books } from "./models";');
        });
    });

    describe('isTsExpression', () => {
        it('recognizes a factory-built expression', () => {
            expect(isTsExpression(ts.factory.createStringLiteral('x'))).toBe(true);
        });

        it('rejects primitives, arrays and plain objects', () => {
            expect(isTsExpression('x')).toBe(false);
            expect(isTsExpression(1)).toBe(false);
            expect(isTsExpression(true)).toBe(false);
            expect(isTsExpression(null)).toBe(false);
            expect(isTsExpression(undefined)).toBe(false);
            expect(isTsExpression([])).toBe(false);
            expect(isTsExpression({ kind: 1 })).toBe(false);
        });
    });

    describe('createPropertyValueExpression', () => {
        it('renders a string as a double-quoted literal', () => {
            expect(nodeToString(createPropertyValueExpression('hello', false))).toBe('"hello"');
        });

        it('renders numbers, including negatives', () => {
            expect(nodeToString(createPropertyValueExpression(7, false))).toBe('7');
            expect(nodeToString(createPropertyValueExpression(-3, false))).toBe('-3');
        });

        it('renders booleans', () => {
            expect(nodeToString(createPropertyValueExpression(true, false))).toBe('true');
            expect(nodeToString(createPropertyValueExpression(false, false))).toBe('false');
        });

        it('passes a compiler expression through unchanged', () => {
            const expression = ts.factory.createIdentifier('DataTypes');
            expect(createPropertyValueExpression(expression, false)).toBe(expression);
        });

        it('renders arrays as array literals', () => {
            expect(nodeToString(createPropertyValueExpression(['a', 'b'], false))).toBe('["a", "b"]');
        });

        it('renders nested objects', () => {
            expect(nodeToString(createPropertyValueExpression({ name: 'idx', unique: true }, false)))
                .toBe('{ name: "idx", unique: true }');
        });
    });

    describe('buildObjectLiteralExpression', () => {
        it('renders a single-line object literal', () => {
            expect(nodeToString(buildObjectLiteralExpression({ tableName: 'users', timestamps: false }, false)))
                .toBe('{ tableName: "users", timestamps: false }');
        });

        it('renders a multi-line object literal', () => {
            expect(nodeToString(buildObjectLiteralExpression({ tableName: 'users', timestamps: false }, true)))
                .toBe('{\n    tableName: "users",\n    timestamps: false\n}');
        });

        it('quotes keys that are not valid identifiers', () => {
            expect(nodeToString(buildObjectLiteralExpression({ 'a-b': 1 }, false)))
                .toBe('{ "a-b": 1 }');
        });
    });

    describe('createTypeNodeFromName', () => {
        it('maps known JS types to their type nodes', () => {
            expect(nodeToString(createTypeNodeFromName('number'))).toBe('number');
            expect(nodeToString(createTypeNodeFromName('string'))).toBe('string');
            expect(nodeToString(createTypeNodeFromName('boolean'))).toBe('boolean');
            expect(nodeToString(createTypeNodeFromName('object'))).toBe('object');
            expect(nodeToString(createTypeNodeFromName('Date'))).toBe('Date');
            expect(nodeToString(createTypeNodeFromName('Uint8Array'))).toBe('Uint8Array');
        });

        it('maps an unknown JS type to the unknown keyword', () => {
            expect(nodeToString(createTypeNodeFromName('whatever'))).toBe('unknown');
        });

        it('maps the any keyword', () => {
            expect(nodeToString(createTypeNodeFromName('any'))).toBe('any');
        });

        it('maps a trailing [] to an array type node', () => {
            expect(nodeToString(createTypeNodeFromName('number[]'))).toBe('number[]');
            expect(nodeToString(createTypeNodeFromName('string[]'))).toBe('string[]');
            expect(nodeToString(createTypeNodeFromName('unknown[]'))).toBe('unknown[]');
        });
    });

    describe('createNullableTypeNode', () => {
        it('unions a type with null', () => {
            expect(nodeToString(createNullableTypeNode(createTypeNodeFromName('string'))))
                .toBe('string | null');
        });
    });

    describe('createGenericTypeReference', () => {
        it('renders a generic type reference with arguments', () => {
            expect(nodeToString(createGenericTypeReference('NonAttribute', [createTypeNodeFromName('Date')])))
                .toBe('NonAttribute<Date>');
        });

        it('renders a bare type reference when there are no arguments', () => {
            expect(nodeToString(createGenericTypeReference('Sequelize', []))).toBe('Sequelize');
        });
    });

    describe('createIndexedAccessTypeNode', () => {
        it('renders an indexed access type with a double-quoted attribute', () => {
            expect(nodeToString(createIndexedAccessTypeNode('races', 'race_id')))
                .toBe('races["race_id"]');
        });
    });

    describe('buildDataTypeExpression', () => {
        it('renders a member access with no arguments', () => {
            const dataType: ISequelizeDataType = { key: 'INTEGER', args: [] };
            expect(nodeToString(buildDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.native)))
                .toBe('DataTypes.INTEGER');
        });

        it('renders numeric arguments with printer spacing', () => {
            const dataType: ISequelizeDataType = { key: 'DECIMAL', args: [7, 2] };
            expect(nodeToString(buildDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.native)))
                .toBe('DataTypes.DECIMAL(7, 2)');
        });

        it('renders ENUM values as double-quoted arguments', () => {
            const dataType: ISequelizeDataType = { key: 'ENUM', args: ['AA', 'BB'] };
            expect(nodeToString(buildDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.native)))
                .toBe('DataTypes.ENUM("AA", "BB")');
        });

        it('agrees with renderDataTypeExpression modulo argument spacing', () => {
            const dataType: ISequelizeDataType = { key: 'DECIMAL', args: [7, 2] };
            const printed = nodeToString(buildDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.native));
            const rendered = renderDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.native);

            expect(printed.replace(/, /g, ',')).toBe(rendered);
        });

        it('renders a nested data type argument in the native namespace', () => {
            const dataType: ISequelizeDataType = {
                key: 'ARRAY',
                args: [{ key: 'INTEGER', args: [] }],
            };
            expect(nodeToString(buildDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.native)))
                .toBe('DataTypes.ARRAY(DataTypes.INTEGER)');
        });

        it('renders a nested data type argument in the decorators namespace', () => {
            const dataType: ISequelizeDataType = {
                key: 'ARRAY',
                args: [{ key: 'TEXT', args: [] }],
            };
            expect(nodeToString(buildDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.decorators)))
                .toBe('DataType.ARRAY(DataType.TEXT)');
        });
    });

});
