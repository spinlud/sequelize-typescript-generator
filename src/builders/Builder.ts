import { IConfig } from '../config';
import { Dialect } from '../dialects/Dialect';

/**
 * @class Builder
 * @constructor
 * @param {IConfig} config
 * @param {Dialect} dialect
 */
export abstract class Builder {
    private _config: IConfig;
    private _dialect: Dialect;

    protected constructor(config: IConfig, dialect: Dialect) {
        this._config = config;
        this._dialect = dialect;
    }

    get config(): IConfig {
        return this._config;
    }

    set config(value: IConfig) {
        this._config = value;
    }

    get dialect(): Dialect {
        return this._dialect;
    }

    set dialect(value: Dialect) {
        this._dialect = value;
    }

    /**
     * Build files with the given configuration and dialect
     * @returns {Promise<void>}
     */
    abstract build(): Promise<void>;
}
