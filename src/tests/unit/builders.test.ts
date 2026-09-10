import { nodeToString, generateNamedImports } from '../../builders/utils.js';
import { buildTableDecoratorProps } from '../../builders/ModelBuilder.js';
import { ITableMetadata } from '../../dialects/Dialect.js';

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
