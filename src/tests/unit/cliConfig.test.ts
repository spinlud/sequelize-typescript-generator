import { aliasesMap, buildConfig } from '../../bin/utils.js';

describe('buildConfig', () => {
    const baseArgv = {
        [aliasesMap.DIALECT]: 'sqlite',
    };

    it('maps --paranoid and --timestamps into the metadata', () => {
        const config = buildConfig({
            ...baseArgv,
            [aliasesMap.TIMESTAMPS]: true,
            [aliasesMap.PARANOID]: true,
        });

        expect(config.metadata?.timestamps).toBe(true);
        expect(config.metadata?.paranoid).toBe(true);
    });

    it('defaults paranoid and timestamps to false when the flags are absent', () => {
        const config = buildConfig(baseArgv);

        expect(config.metadata?.timestamps).toBe(false);
        expect(config.metadata?.paranoid).toBe(false);
    });

    it('maps --no-associations into metadata.associations set to false', () => {
        const config = buildConfig({
            ...baseArgv,
            [aliasesMap.ASSOCIATIONS]: false,
        });

        expect(config.metadata?.associations).toBe(false);
    });

    it('leaves metadata.associations absent when the flag is enabled', () => {
        const config = buildConfig({
            ...baseArgv,
            [aliasesMap.ASSOCIATIONS]: true,
        });

        expect(config.metadata && 'associations' in config.metadata).toBe(false);
    });

    it('leaves metadata.associations absent when the flag is not provided', () => {
        const config = buildConfig(baseArgv);

        expect(config.metadata && 'associations' in config.metadata).toBe(false);
    });

    it('maps -F/--format into config.format', () => {
        expect(buildConfig({ ...baseArgv, [aliasesMap.FORMAT]: 'native' }).format).toBe('native');
        expect(buildConfig({ ...baseArgv, [aliasesMap.FORMAT]: 'decorators' }).format).toBe('decorators');
    });

    it('leaves config.format absent for an unknown format value', () => {
        const config = buildConfig({ ...baseArgv, [aliasesMap.FORMAT]: 'bogus' });

        expect('format' in config).toBe(false);
    });

    it('sets strict false when -R sets the no-strict alias', () => {
        const config = buildConfig({ ...baseArgv, [aliasesMap.DISABLE_STRICT]: true });

        expect(config.strict).toBe(false);
    });

    it('sets strict false when --no-strict is parsed as strict:false', () => {
        const config = buildConfig({ ...baseArgv, strict: false });

        expect(config.strict).toBe(false);
    });

    it('defaults strict to true when neither spelling is present', () => {
        const config = buildConfig(baseArgv);

        expect(config.strict).toBe(true);
    });

    it('sets noViews true when -V sets the no-views alias', () => {
        const config = buildConfig({ ...baseArgv, [aliasesMap.DISABLE_VIEWS]: true });

        expect(config.metadata?.noViews).toBe(true);
    });

    it('sets noViews true when --no-views is parsed as views:false', () => {
        const config = buildConfig({ ...baseArgv, views: false });

        expect(config.metadata?.noViews).toBe(true);
    });

    it('defaults noViews to false when neither spelling is present', () => {
        const config = buildConfig(baseArgv);

        expect(config.metadata?.noViews).toBe(false);
    });
});
