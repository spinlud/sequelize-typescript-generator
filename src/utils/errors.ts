/**
 * Type guard for Node.js system errors carrying an errno `code`.
 * @param {unknown} err
 * @returns {err is NodeJS.ErrnoException}
 */
export const isErrnoException = (err: unknown): err is NodeJS.ErrnoException =>
    typeof err === 'object' && err !== null && 'code' in err;
