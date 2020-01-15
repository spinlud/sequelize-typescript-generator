import { generateNamedImports } from '../generators';

describe('Generators', () => {

    describe('named imports', () => {
        it('should generate single import statement', () => {
            const importsSpecifier = 'Token1';
            const moduleSpecifier = `some-module`;
            const expected = `import { ${importsSpecifier} } from "${moduleSpecifier}";`;

            expect(generateNamedImports([importsSpecifier], moduleSpecifier)).toBe(expected);
        });

        it('should generate multiple named imports statement', () => {
            const importsSpecifiers = ['Token1', 'Token2', 'Token3'];
            const moduleSpecifier = `some-module`;
            const expected = `import { ${importsSpecifiers.join(`, `)} } from "${moduleSpecifier}";`;

            expect(generateNamedImports(importsSpecifiers, moduleSpecifier)).toBe(expected);
        });
    });

});
