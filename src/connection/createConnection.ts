import path from 'path';
import { createRequire } from 'module';
import { Options } from 'sequelize';
import { Sequelize } from 'sequelize';

const SQLITE_DRIVER_PACKAGE = '@vscode/sqlite3';

/**
 * Resolve the SQLite driver from the consumer project.
 * @param {string} cwd Directory whose `package.json` anchors the resolution
 * @returns {object} The resolved driver module passed to Sequelize as `dialectModule`
 * @throws {Error} When the driver package cannot be resolved
 */
export const resolveSqliteDriver = (cwd: string = process.cwd()): object => {
    const requireFromProject = createRequire(path.join(cwd, 'package.json'));

    let driver: unknown;

    try {
        driver = requireFromProject(SQLITE_DRIVER_PACKAGE);
    }
    catch (err) {
        throw new Error(
            `SQLite support requires the '${SQLITE_DRIVER_PACKAGE}' package. ` +
            `Install it in your project: npm install -S ${SQLITE_DRIVER_PACKAGE}`,
            { cause: err }
        );
    }

    if (typeof driver !== 'object' || driver === null) {
        throw new Error(`Resolved '${SQLITE_DRIVER_PACKAGE}' is not a valid module`);
    }

    return driver;
};

/**
 * Create a new sequelize connection
 * @param {Options} options
 * @returns {Sequelize}
 */
export const createConnection = (options: Options): Sequelize => {
    if (options.dialect === 'sqlite' && !options.dialectModule) {
        return new Sequelize({ ...options, dialectModule: resolveSqliteDriver() });
    }

    return new Sequelize(options);
};
