import path from 'path';
import { pathToFileURL } from 'url';
import { ESLint } from 'eslint';
import { eslintDefaultConfig } from './eslintDefaultConfig.js';
import { ILintOptions } from '../config/IConfig.js';

const ESLINT_MIGRATION_GUIDE_URL = 'https://eslint.org/docs/latest/use/configure/migration-guide';

const LEGACY_ESLINTRC_BASENAME_PATTERN = /^\.eslintrc(\.(js|cjs|json|yaml|yml))?$/;

const LEGACY_CONFIG_KEYS = ['extends', 'env'] as const;

/**
 * Throw when a lint file basename matches the legacy `.eslintrc*` naming.
 * @param {string} configFile
 * @returns {void}
 */
const assertNotLegacyEslintrcBasename = (configFile: string): void => {
    const basename = path.basename(configFile);

    if (LEGACY_ESLINTRC_BASENAME_PATTERN.test(basename)) {
        throw new Error(
            `Legacy ESLint config file '${basename}' is not supported. ` +
            `sequelize-typescript-generator requires an ESLint flat config. ` +
            `See ${ESLINT_MIGRATION_GUIDE_URL}`
        );
    }
};

/**
 * Throw when a resolved config value carries legacy (eslintrc) shape markers:
 * an `extends` key, an `env` key, or a string `parser`. Accepts flat config,
 * where `parser` is an object under `languageOptions`.
 * @param {unknown} config
 * @param {string} sourcePath
 * @returns {void}
 */
export const assertFlatConfig = (config: unknown, sourcePath: string): void => {
    const elements: unknown[] = Array.isArray(config) ? config : [config];

    for (const element of elements) {
        if (typeof element !== 'object' || element === null) {
            continue;
        }

        for (const key of LEGACY_CONFIG_KEYS) {
            if (key in element) {
                throw new Error(
                    `Legacy ESLint config detected in '${sourcePath}': '${key}' is not valid in a flat config. ` +
                    `See ${ESLINT_MIGRATION_GUIDE_URL}`
                );
            }
        }

        if ('parser' in element && typeof element.parser === 'string') {
            throw new Error(
                `Legacy ESLint config detected in '${sourcePath}': a string 'parser' is not valid in a flat config ` +
                `(use 'languageOptions.parser' with the imported parser module). ` +
                `See ${ESLINT_MIGRATION_GUIDE_URL}`
            );
        }
    }
};

/**
 * Import a config module and unwrap a default export, if present.
 * @param {string} configFile
 * @returns {Promise<unknown>}
 */
const importConfigModule = async (configFile: string): Promise<unknown> => {
    const moduleUrl = pathToFileURL(configFile).href;
    const imported: unknown = await import(moduleUrl);

    if (typeof imported === 'object' && imported !== null && 'default' in imported) {
        return imported.default;
    }

    return imported;
};

/**
 * Longest common directory of the given lint paths. ESLint flat config ignores
 * files outside its base path, so the engine runs with this directory as `cwd`
 * to cover output directories located outside the current working directory.
 * @param {string[]} paths
 * @returns {string}
 */
const commonBaseDir = (paths: string[]): string => {
    const directories = paths.map(p => path.dirname(path.resolve(p)));

    if (directories.length === 0) {
        return process.cwd();
    }

    const splitDirectories = directories.map(dir => dir.split(path.sep));
    const commonSegments: string[] = [];

    for (let index = 0; index < splitDirectories[0].length; index++) {
        const segment = splitDirectories[0][index];

        if (splitDirectories.every(segments => segments[index] === segment)) {
            commonSegments.push(segment);
        }
        else {
            break;
        }
    }

    return commonSegments.join(path.sep) || path.sep;
};

/**
 * @class Linter
 */
export class Linter {
    private readonly fix: boolean;

    private readonly configFile?: string;

    constructor(options?: ILintOptions) {
        if (options) {
            const configFile = path.resolve(options.configFile);
            assertNotLegacyEslintrcBasename(configFile);
            this.configFile = configFile;
            this.fix = options.fix ?? true;
        }
        else {
            this.fix = true;
        }
    }

    async lintFiles(paths: string[]): Promise<void> {
        const cwd = commonBaseDir(paths);
        let engine: ESLint;

        if (this.configFile) {
            const config = await importConfigModule(this.configFile);
            assertFlatConfig(config, this.configFile);

            engine = new ESLint({
                cwd,
                overrideConfigFile: this.configFile,
                fix: this.fix,
            });
        }
        else {
            engine = new ESLint({
                cwd,
                overrideConfigFile: true,
                baseConfig: eslintDefaultConfig,
                fix: this.fix,
            });
        }

        const report = await engine.lintFiles(paths);
        await ESLint.outputFixes(report);
    }
}
