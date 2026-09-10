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
});
