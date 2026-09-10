import { nodeToString, generateNamedImports } from '../../builders/utils.js';
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

});
