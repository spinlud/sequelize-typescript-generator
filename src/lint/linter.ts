import { CLIEngine } from 'eslint';
import { eslintConfig } from './eslint.config';

const cli = new CLIEngine({
    baseConfig: eslintConfig,
    fix: true,
});

/**
 * Lint files using a predefined set of rules
 * @param {string[]} paths
 */
export const lintFiles = (paths: string[]): void => {
    console.log('Linting files...');
    const report = cli.executeOnFiles(paths);
    CLIEngine.outputFixes(report);
    console.log('Linting done')
}
