module.exports = {
    roots: ['<rootDir>/src/tests'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    testPathIgnorePatterns: [
        'environment.ts',
        'testsData.ts',
        'testRunner',
    ],
    verbose: true,
};
