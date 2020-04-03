import { CLIEngine } from 'eslint';
import { eslintDefaultConfig } from './eslintDefaultConfig';

/**
 * @class Linter
 */
export class Linter {
    private engine: CLIEngine;

    constructor(options?: CLIEngine.Options) {
        if (options) {
            this.engine = new CLIEngine(options);
        }
        else {
            this.engine = new CLIEngine({
                baseConfig: eslintDefaultConfig,
                fix: true,
            });
        }
    }

    lintFiles(paths: string[]): void {
        const report = this.engine.executeOnFiles(paths);
        CLIEngine.outputFixes(report);
    }
}
