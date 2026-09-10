import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import {
    DECORATORS_RUNTIME_PACKAGE,
    buildDecoratorsDependencyWarning,
    isPackageResolvableFrom,
    warnWhenDecoratorsDependencyIsMissing,
} from '../../builders/decoratorsDependency.js';

describe('isPackageResolvableFrom', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-deps-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('returns false when the package cannot be resolved from the directory', () => {
        expect(isPackageResolvableFrom(DECORATORS_RUNTIME_PACKAGE, tempDir)).toBe(false);
    });

    it('returns true when the package resolves from the directory', async () => {
        const packageDir = path.join(tempDir, 'node_modules', DECORATORS_RUNTIME_PACKAGE);
        await fs.mkdir(packageDir, { recursive: true });
        await fs.writeFile(
            path.join(packageDir, 'package.json'),
            JSON.stringify({ name: DECORATORS_RUNTIME_PACKAGE, version: '0.0.0', main: 'index.js' })
        );
        await fs.writeFile(path.join(packageDir, 'index.js'), 'module.exports = {};');

        expect(isPackageResolvableFrom(DECORATORS_RUNTIME_PACKAGE, tempDir)).toBe(true);
    });

    it('never throws', () => {
        expect(() => isPackageResolvableFrom(DECORATORS_RUNTIME_PACKAGE, tempDir)).not.toThrow();
    });
});

describe('buildDecoratorsDependencyWarning', () => {
    it('returns a non-empty string mentioning the output directory', () => {
        const warning = buildDecoratorsDependencyWarning('/tmp/models');

        expect(typeof warning).toBe('string');
        expect(warning.length).toBeGreaterThan(0);
        expect(warning).toContain('/tmp/models');
        expect(warning).toContain(DECORATORS_RUNTIME_PACKAGE);
    });

    it('never throws', () => {
        expect(() => buildDecoratorsDependencyWarning('/tmp/models')).not.toThrow();
    });
});

describe('warnWhenDecoratorsDependencyIsMissing', () => {
    it('never throws', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-deps-'));

        try {
            expect(() => warnWhenDecoratorsDependencyIsMissing(tempDir)).not.toThrow();
        }
        finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
});
