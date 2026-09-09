/**
 * Output formats the integration suite exercises. Only `decorators` exists
 * today; the `native` format arrives in a later phase and will be appended
 * here so every scenario runs once per format.
 */
export type Format = 'decorators';

export const FORMATS: readonly Format[] = ['decorators'];
