const { createDefaultEsmPreset } = require('ts-jest');

/** @type {import('jest').Config} */
module.exports = {
    ...createDefaultEsmPreset({
        // The build uses "module": "nodenext"; ts-jest only warns that hybrid module
        // kinds prefer isolatedModules. Suppress that advisory while keeping type checking.
        diagnostics: { ignoreCodes: [151002] },
        // Generated decorator models import each other circularly. Under ESM, the eager
        // "design:type" reference emitted by emitDecoratorMetadata hits the temporal dead
        // zone. The models declare explicit column types, so the metadata is unused.
        //
        // The decorator models expose plain public class fields without "declare".
        // Target ES2022 turns useDefineForClassFields on, which would emit real fields
        // that shadow Sequelize's attribute getters and setters, so keep it off.
        tsconfig: {
            emitDecoratorMetadata: false,
            useDefineForClassFields: false,
        },
    }),
    roots: ['<rootDir>/src/tests'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testPathIgnorePatterns: [
        'environment.ts',
        'testsData.ts',
        'TestRunner.ts',
    ],
    verbose: true,
};
