import { CLIEngine } from 'eslint';
import path from 'path';

const cli = new CLIEngine({
    configFile: path.join(__dirname, 'eslint.config.js'),
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
