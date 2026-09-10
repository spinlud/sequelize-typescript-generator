import {
    FORMATS,
    DEFAULT_FORMAT,
    isFormat,
    resolveFormat,
    shouldNoticeIgnoredStrict,
    STRICT_IGNORED_NOTICE,
    Format,
} from '../../config/format.js';
import { IConfig } from '../../config/IConfig.js';

const buildConfig = (overrides: Partial<IConfig> = {}): IConfig => ({
    connection: { dialect: 'sqlite' },
    output: { outDir: 'output-models' },
    ...overrides,
});

describe('format vocabulary', () => {
    it('exposes native and decorators as the known formats', () => {
        expect(FORMATS).toEqual(['native', 'decorators']);
    });

    it('defaults to native', () => {
        expect(DEFAULT_FORMAT).toBe('native');
    });
});

describe('isFormat', () => {
    it('accepts every known format', () => {
        for (const format of FORMATS) {
            expect(isFormat(format)).toBe(true);
        }
    });

    it('rejects unknown strings and non-strings', () => {
        expect(isFormat('bogus')).toBe(false);
        expect(isFormat('')).toBe(false);
        expect(isFormat(123)).toBe(false);
        expect(isFormat(undefined)).toBe(false);
        expect(isFormat(null)).toBe(false);
        expect(isFormat({})).toBe(false);
    });
});

describe('resolveFormat', () => {
    it('returns the configured format when set', () => {
        expect(resolveFormat(buildConfig({ format: 'decorators' }))).toBe('decorators');
        expect(resolveFormat(buildConfig({ format: 'native' }))).toBe('native');
    });

    it('falls back to the default format when unset', () => {
        expect(resolveFormat(buildConfig())).toBe(DEFAULT_FORMAT);
    });
});

describe('shouldNoticeIgnoredStrict', () => {
    it('is true only when native and strict is explicitly disabled', () => {
        expect(shouldNoticeIgnoredStrict(buildConfig({ format: 'native', strict: false }))).toBe(true);
        expect(shouldNoticeIgnoredStrict(buildConfig({ strict: false }))).toBe(true);
    });

    it('is false when strict is not explicitly disabled', () => {
        expect(shouldNoticeIgnoredStrict(buildConfig({ format: 'native', strict: true }))).toBe(false);
        expect(shouldNoticeIgnoredStrict(buildConfig({ format: 'native' }))).toBe(false);
    });

    it('is false for the decorators format', () => {
        expect(shouldNoticeIgnoredStrict(buildConfig({ format: 'decorators', strict: false }))).toBe(false);
    });

    it('exposes a notice message mentioning native and strict', () => {
        expect(STRICT_IGNORED_NOTICE).toContain('native');
        expect(STRICT_IGNORED_NOTICE).toContain('strict');
    });
});

describe('Format type', () => {
    it('is inhabited by the FORMATS members', () => {
        const format: Format = 'native';
        expect(FORMATS).toContain(format);
    });
});
