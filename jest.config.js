module.exports = {
    roots: ['<rootDir>/src/tests'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    testPathIgnorePatterns: [
        'environment.ts',
    ],
    verbose: true,
};
