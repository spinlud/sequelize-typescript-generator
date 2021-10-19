import { ESLint } from 'eslint';
import { eslintDefaultConfig } from './eslintDefaultConfig';

/**
 * @class Linter
 */
export class Linter {
    private engine: ESLint;

    constructor(options?: ESLint.Options) {
        if (options) {
            this.engine = new ESLint(options);
        }
        else {
            this.engine = new ESLint({
                baseConfig: eslintDefaultConfig,
                fix: true,
            });
        }
    }

    async lintFiles(paths: string[]): Promise<void> {
        const report = await this.engine.lintFiles(paths);
        await ESLint.outputFixes(report);
    }
}
