import type { IConfig } from './IConfig.js';

/**
 * Output formats the generator can emit.
 * - native: plain Sequelize classes with declare fields, Model.init and an initModels wiring file
 * - decorators: sequelize-typescript decorators
 */
export const FORMATS = ['native', 'decorators'] as const;

export type Format = typeof FORMATS[number];

export const DEFAULT_FORMAT: Format = 'native';

/**
 * Notice printed when strict mode is disabled together with the native format,
 * where it has no effect.
 */
export const STRICT_IGNORED_NOTICE =
    'Notice: strict mode applies to the decorators format only and is ignored with --format native, ' +
    'where attributes are typed with InferAttributes.';

/**
 * Type guard for a supported output format.
 */
export const isFormat = (value: unknown): value is Format =>
    typeof value === 'string' && FORMATS.some(format => format === value);

/**
 * Resolve the configured output format, falling back to the default when unset.
 */
export const resolveFormat = (config: IConfig): Format => config.format ?? DEFAULT_FORMAT;

/**
 * Whether the strict-ignored notice should be printed: strict mode is only
 * meaningful for the decorators format, so disabling it under native is a no-op.
 */
export const shouldNoticeIgnoredStrict = (config: IConfig): boolean =>
    resolveFormat(config) === 'native' && config.strict === false;
