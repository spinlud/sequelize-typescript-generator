const now = new Date();
const nowFormatted = now
    .toLocaleString( 'sv', { timeZoneName: 'short' } )
    .substring(0, 19).split(':').join('-').replace(' ', 'T');

module.exports = {
    reporters: [
        'default',
        ['jest-html-reporters', {
            publicPath: process.cwd() + '\\test-results',
            filename: `test-run_${nowFormatted}.html`
        }]
      ],
    roots: ['<rootDir>/src/tests'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    testPathIgnorePatterns: [
        'environment.ts',
        'testsData.ts',
        'testRunner',
        'test-helpers'
    ],
    verbose: true,
};
