import { nodeToString, generateNamedImports } from '../../builders/utils';

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
