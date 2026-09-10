import { Sequelize } from 'sequelize';
import { buildSequelizeOptions } from '../environment.js';
import { DIALECT_NAMES, DialectName } from '../../dialects/Dialect.js';

const DEFAULT_TIMEOUT_MS = 60_000;
const MSSQL_TIMEOUT_MS = 120_000;
const DEFAULT_RETRY_DELAY_MS = 2_000;
const DEFAULT_DATABASE_NAME = 'testdb';

const isSupportedDialect = (value: string): value is DialectName =>
    DIALECT_NAMES.some((dialect) => dialect === value);

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface RetryPolicy {
    deadline: number;
    timeoutMs: number;
    retryDelayMs: number;
}

/**
 * Retry an asynchronous action until it succeeds or the deadline passes.
 * @param {string} label
 * @param {RetryPolicy} policy
 * @param {() => Promise<void>} action
 */
const waitUntil = async (
    label: string,
    policy: RetryPolicy,
    action: () => Promise<void>,
): Promise<void> => {
    const { deadline, timeoutMs, retryDelayMs } = policy;
    let lastError: unknown;

    while (Date.now() < deadline) {
        try {
            await action();
            return;
        }
        catch (error) {
            lastError = error;
            console.log(`Waiting for ${label} to become available...`);
            await delay(retryDelayMs);
        }
    }

    throw new Error(`Timed out after ${timeoutMs} ms waiting for ${label}: ${getErrorMessage(lastError)}`);
};

const main = async (): Promise<void> => {
    const dialectArg = process.env.TEST_DB_DIALECT ?? process.argv[2];

    if (!dialectArg) {
        throw new Error('No dialect provided. Set TEST_DB_DIALECT or pass the dialect as the first argument.');
    }

    if (!isSupportedDialect(dialectArg)) {
        throw new Error(`Unsupported dialect "${dialectArg}". Supported dialects: ${DIALECT_NAMES.join(', ')}.`);
    }

    const dialect = dialectArg;
    const options = { ...buildSequelizeOptions(dialect), logging: false };
    const timeoutMs = parsePositiveInt(
        process.env.TEST_DB_WAIT_TIMEOUT_MS,
        dialect === 'mssql' ? MSSQL_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
    );
    const retryDelayMs = parsePositiveInt(process.env.TEST_DB_WAIT_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS);
    const retryPolicy: RetryPolicy = {
        deadline: Date.now() + timeoutMs,
        timeoutMs,
        retryDelayMs,
    };

    // SQL Server starts without the test database; connect to "master" and create it on demand.
    if (dialect === 'mssql') {
        const databaseName = options.database ?? DEFAULT_DATABASE_NAME;
        const masterOptions = { ...options, database: 'master' };

        await waitUntil('SQL Server (master)', retryPolicy, async () => {
            const master = new Sequelize(masterOptions);

            try {
                await master.authenticate();
                await master.query(`IF DB_ID('${databaseName}') IS NULL CREATE DATABASE [${databaseName}]`);
            }
            finally {
                await master.close();
            }
        });
    }

    await waitUntil(`${dialect} database`, retryPolicy, async () => {
        const sequelize = new Sequelize(options);

        try {
            await sequelize.authenticate();
        }
        finally {
            await sequelize.close();
        }
    });

    console.log(`${dialect} database is ready`);
};

main().catch((error: unknown) => {
    console.error(getErrorMessage(error));
    process.exit(1);
});
