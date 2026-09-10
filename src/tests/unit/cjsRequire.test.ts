import path from 'path';
import { existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const buildEntryPath = path.join(repoRoot, 'build', 'index.js');

describe('CommonJS require of the package root entry', () => {
    it('loads with require() from a CommonJS script and exposes the public API', () => {
        if (!existsSync(buildEntryPath)) {
            throw new Error(
                `Build output not found at '${buildEntryPath}'. Run "npm run build" before the tests.`
            );
        }

        // A CommonJS require() of the ESM root entry only succeeds when the shipped
        // package has no top-level await (Node's require(esm) support).
        const script =
            `const mod = require(${JSON.stringify(buildEntryPath)});` +
            `const keys = Object.keys(mod);` +
            `if (!keys.includes('createDialect') || !keys.includes('ModelBuilder')) {` +
            `throw new Error('Missing expected exports, got: ' + keys.join(','));}` +
            `process.stdout.write(keys.join(','));`;

        const output = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
        const exportedKeys = output.split(',');

        expect(exportedKeys).toEqual(expect.arrayContaining(['createDialect', 'ModelBuilder']));
    });
});
