import { createRequire } from 'module';
import { isErrnoException } from '../utils/errors.js';

/**
 * Runtime package the decorators format depends on in the target project.
 */
export const DECORATORS_RUNTIME_PACKAGE = 'sequelize-typescript';

/**
 * Build the warning shown when the decorators runtime dependency cannot be
 * resolved from the output directory.
 * @param {string} outDir
 * @returns {string}
 */
export const buildDecoratorsDependencyWarning = (outDir: string): string =>
    `Warning: --format decorators emits models that import "${DECORATORS_RUNTIME_PACKAGE}", ` +
    `but it cannot be resolved from ${outDir}. ` +
    `Install it in the target project: npm install sequelize-typescript reflect-metadata\n` +
    `Or use --format native (the default), which depends on sequelize only.`;

/**
 * Whether a package can be resolved starting from a directory. Never throws:
 * a missing module resolves to false, any other resolution error to true so a
 * transient failure does not surface a misleading dependency warning.
 * @param {string} packageName
 * @param {string} directory
 * @returns {boolean}
 */
export const isPackageResolvableFrom = (packageName: string, directory: string): boolean => {
    const require = createRequire(import.meta.url);

    try {
        require.resolve(packageName, { paths: [directory] });
        return true;
    }
    catch (err: unknown) {
        return !(isErrnoException(err) && err.code === 'MODULE_NOT_FOUND');
    }
};

/**
 * Warn once when the decorators runtime dependency is missing from the output
 * directory. Emitted only for the decorators format; never throws.
 * @param {string} outDir
 * @returns {void}
 */
export const warnWhenDecoratorsDependencyIsMissing = (outDir: string): void => {
    if (!isPackageResolvableFrom(DECORATORS_RUNTIME_PACKAGE, outDir)) {
        console.warn(buildDecoratorsDependencyWarning(outDir));
    }
};
