# Change Log

---

### Unreleased
#### Minor changes and bug fixes:
* MySQL `BIGINT` columns are now generated with the `string` JS/TS type (was `number`) to avoid precision loss and match the MariaDB and MSSQL dialects.

---

### 13.0.0
#### Breaking changes:
* Native is now the default output format; pass `--format decorators` for the old `sequelize-typescript` decorators output.
* ESM-only package; Node `>=22.13.0` required.
* SQLite driver switched to `@vscode/sqlite3` (`sqlite3` is no longer supported).
* Associations are discovered from foreign keys by default; `--no-associations` restores the old behaviour.
* `--lint-file` accepts flat config files only; legacy `.eslintrc*` files fail fast.
* Deep imports under `build/` are closed by the package `exports` map (root entry only).

#### Minor changes and bug fixes:
* New `--paranoid` flag: emit paranoid table options for tables with a `deleted_at`/`deletedAt` column (requires `--timestamps`).
* `createDialect` factory exported from the package root.
* SQL Server `schema` in table options and `hasTrigger` detection.
* See `docs/migration/12-to-13.md` for the full migration guide.

---

### 10.1.0
#### Breaking changes:

#### Minor changes and bug fixes:
* Libraries update
* Changed node.js version to v14.21.3 to test latest versions of `typescript` using `jest` 

---

### 10.0.0
#### Breaking changes:
* Typescript: `4.9.4` -> `5.0.2`
* MySQL driver: `mysql2@2.3.3` -> `mysql2@3.2.0`

#### Minor changes and bug fixes:
* Added change log file

---

### 9.0.3
#### Breaking changes:
* NA
#### Minor changes and bug fixes:
* NA

---