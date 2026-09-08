# Database version matrix and driver status

Research for [issue #65](https://github.com/spinlud/sequelize-typescript-generator/issues/65).
Snapshot date: 2026-09-08. All facts below were read from the primary source cited in the same section; nothing is taken from secondary write-ups.

## 1. Summary

| Engine | Latest stable major | Oldest still vendor-supported | Official image and tags for both | arm64 native |
| --- | --- | --- | --- | --- |
| PostgreSQL | 18 (18.6) | 14 (EOL 2026-11-12) | `postgres:18`, `postgres:14` (Docker Hub official) | yes |
| MySQL | 26.7 (calendar Innovation); LTS: 9.7 | 8.4 LTS (8.0 moved to Sustaining Support 2026-04-21) | `mysql:9.7` / `mysql:lts`, `mysql:8.4`; `mysql:innovation` = 26.7 | yes |
| MariaDB | 13.0 rolling; LTS: 12.3 | 10.11 (EOL 2028-02-16; 10.6 EOL 2026-07-06 already passed) | `mariadb:12.3` (= `lts` = `latest`), `mariadb:10.11` | yes |
| SQL Server | 2025 (17.x) | 2017 (extended support to 2027-10-13) | `mcr.microsoft.com/mssql/server:2025-latest`, `:2017-latest` | no, amd64 only |

Current defaults in this repo (`src/tests/integration/*/docker-start-*.sh`): `postgres:16`, `mysql:8`, `mariadb:11`, `mcr.microsoft.com/mssql/server:2022-latest` (forced `--platform=linux/amd64`). All four are still vendor-supported today, but none is the latest major.

## 2. PostgreSQL

Source: https://www.postgresql.org/support/versioning/

- Policy: "The PostgreSQL Global Development Group supports a major version for 5 years after its initial release."
- Supported majors and final release dates: 18 (18.6, first release 2025-09-25, final 2030-11-14), 17 (17.11, 2029-11-08), 16 (16.15, 2028-11-09), 15 (15.19, 2027-11-11), 14 (14.24, 2026-11-12).
- 13 is unsupported since 2025-11-13.

Docker Hub official image `postgres` (https://github.com/docker-library/docs/blob/master/postgres/README.md, tag data from `hub.docker.com/v2/repositories/library/postgres/tags`):

- Tag groups published: `19beta3` (beta), `18` / `18.6`, `17` / `17.11`, `16` / `16.15`, `15` / `15.19`, `14` / `14.24`, each with `bookworm`, `trixie`, `alpine3.23/3.24` variants.
- Architectures: amd64, arm32v5/v6/v7, arm64v8, i386, ppc64le, riscv64, s390x. Verified on tags `18` and `14`: linux/amd64 and linux/arm64 present.

## 3. MySQL

Sources:
- Release model: https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html
- Supported versions: https://www.mysql.com/support/supportedplatforms/database.html
- EOL notice: https://www.mysql.com/support/eol-notice.html
- Release notes: https://dev.mysql.com/doc/relnotes/mysql/8.4/en/news-8-4-0.html, https://dev.mysql.com/doc/relnotes/mysql/9.7/en/news-9-7-0.html, https://dev.mysql.com/doc/relnotes/mysql/26.7/en/news-26-7-0.html

Findings:

- Two tracks. LTS: "5 years of premier support" plus "3 years of extended support" under the Oracle Lifetime Support Policy; only bug and security fixes. Innovation: supported "until the next Innovation release".
- LTS series named in the manual: 8.4.x LTS and 9.7.x LTS. The supported-platforms page lists exactly two supported server versions: 9.7 LTS and 8.4 LTS.
- 8.4.0 GA 2024-04-30. 9.7.0 GA 2026-04-21 (9.7.3 on 2026-08-18 is the latest LTS patch).
- Versioning change: "MySQL Server now uses calendar-based versioning for releases after the 9.7 LTS series. Version values use Year.Month.Patch (YY.M.P) format. MySQL 26.7.0 is the first such calendar-version release." (26.7.0 on 2026-07-28, 26.7.1 on 2026-08-18.) 26.7 is the current Innovation line.
- 8.0: "as of April 21, 2026, MySQL 8.0 is covered under Oracle Sustaining Support. Users are encouraged to upgrade to MySQL 8.4 LTS or 9.7 LTS." Sustaining Support means no new fixes; 8.0 is therefore not a version to target for new work.
- 5.7: under Sustaining Support since 2023-10-25.
- Derived from the policy text: 8.4 premier support runs to about 2029-04 and extended to about 2032-04; 9.7 to about 2031-04 / 2034-04. Oracle's lifetime-support PDF was not fetchable (HTTP 403), so treat these dates as computed, not quoted.

Docker Hub official image `mysql` (https://github.com/docker-library/docs/blob/master/mysql/README.md, tag data from Docker Hub API):

- `26.7.0`, `26.7`, `26`, `innovation`, `latest` (Innovation line).
- `9.7.2`, `9.7`, `9`, `lts` (LTS line; the image lags the 9.7.3 server release).
- `8.4.11`, `8.4`, `8` (previous LTS). `8.0` / `8.0.46` still published but 8.0 is in Sustaining Support.
- Architectures: amd64, arm64v8. Verified on `8.4`, `lts`, `9.7`, `innovation`, `26`: linux/amd64 and linux/arm64.
- Warning for this repo: `mysql:8` now resolves to 8.4.x, not 8.0.x (8.4 removed features and changed defaults versus 8.0).

## 4. MariaDB

Sources:
- Maintenance policy and release table: https://mariadb.org/about/ (section "Maintenance Policy")
- Release list: https://mariadb.com/kb/en/mariadb-server-release-dates/

Findings:

- Policy: "A new long-term release (LTS) of MariaDB Server is announced yearly." Rolling releases "are announced on a quarterly basis." Community LTS binaries are released for 3 years after GA, with critical and security fixes in source for a further 2 years.
- LTS series, GA date, community EOL:
  - 12.3: GA 2026-05-28, EOL 2029-06-12 (current LTS; the KB states it is "maintained for three years")
  - 11.8: GA 2025-06-04, EOL 2028-06-04
  - 11.4: GA 2024-05-29, EOL 2029-05-29
  - 10.11: GA 2023-02-16, EOL 2028-02-16
  - 10.6: GA 2021-07-06, EOL 2026-07-06 (passed; Enterprise binaries continue until 2028-08-23)
  - 10.5: EOL 2025-06-24
- Rolling: 13.0 is the current rolling release (community EOL Q4 2026); 13.1 is in development.
- Oldest community-supported LTS today: 10.11.

Docker Hub official image `mariadb` (https://github.com/docker-library/docs/blob/master/mariadb/README.md, tag data from Docker Hub API):

- `12.3.3`, `12.3`, `12`, `lts`, `latest` all share one digest (build of 2026-08-24).
- `11.8.9`, `11.8`, `11`; `11.4.13`, `11.4`; `10.11.19`, `10.11`, `10`; `10.6.28`, `10.6`. `13` is not published yet. Variants: `noble`, `jammy`, `ubi9`, `ubi10`.
- Architectures: amd64, arm64v8, ppc64le, s390x. Verified on `11.8`, `10.6`, `lts`.
- Warning for this repo: `mariadb:11` resolves to 11.8.x, and the top-level `10` tag now resolves to 10.11.x.

## 5. SQL Server

Sources:
- Lifecycle pages: https://learn.microsoft.com/en-us/lifecycle/products/sql-server-2016, .../sql-server-2017, .../sql-server-2019, .../sql-server-2022, .../sql-server-2025
- Container deployment: https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-deployment
- Tag list: https://mcr.microsoft.com/v2/mssql/server/tags/list
- Azure SQL Edge: https://learn.microsoft.com/en-us/azure/azure-sql-edge/overview

Lifecycle (Fixed policy; dates in PT):

| Version | Start | Mainstream end | Extended end |
| --- | --- | --- | --- |
| 2016 | 2016-06-01 | 2021-07-14 | 2026-07-15 (passed; only paid ESU from here) |
| 2017 | 2017-09-29 | 2022-10-12 | 2027-10-13 |
| 2019 | 2019-11-04 | 2025-03-01 | 2030-01-09 |
| 2022 | 2022-11-16 | 2028-01-12 | 2033-01-12 |
| 2025 (17.x) | 2025-11-18 | 2031-01-07 | 2036-01-07 |

Latest stable major is 2025; the oldest with vendor support (extended) is 2017. 2022 and 2025 are the only versions still in mainstream support.

Container image `mcr.microsoft.com/mssql/server`:

- Tags: `2017-latest`, `2019-latest`, `2022-latest`, `2025-latest`, `latest`, `latest-ubuntu`, plus per-CU tags such as `2022-CU26-ubuntu-22.04`, `2025-CU8-ubuntu-24.04`.
- Architecture: every `*-latest` tag is a single-platform manifest for linux/amd64 (verified with `docker manifest inspect -v` on 2017/2019/2022/2025/latest). There is no arm64 image.
- Microsoft's statement: "SQL Server container images are supported only on Linux hosts running on Intel and AMD x86-64 CPUs. Emulation or translation environments (for example, Rosetta 2, Prism, or QEMU) aren't tested or supported."
- The former arm64 workaround, Azure SQL Edge, "is retired as of September 30, 2025" and "no longer supports the ARM64 platform".
- Consequence: on Apple Silicon or other arm64 hosts the only option is `--platform=linux/amd64` under emulation (what `docker-start-mssql.sh` already does). It is unsupported by Microsoft and slower, but works for the integration tests.

## 6. Drivers used by the generator

Versions and dates from `npm view <pkg>` on 2026-09-08. The generator lists these as devDependencies in `package.json`: `pg ^8.13.1`, `pg-hstore ^2.3.4`, `mysql2 ^3.12.0`, `mariadb ^3.4.0`, `tedious ^18.6.1`, `sqlite3 ^5.1.7`.

| Package | Latest | Last publish | engines.node | Status |
| --- | --- | --- | --- | --- |
| pg | 8.23.0 | 2026-08-08 | >= 16 | active (8.20 to 8.23 published Mar to Aug 2026) |
| pg-hstore | 2.3.4 | 2023-03-07 | >= 0.8 | dormant; tiny serializer with no known need for updates |
| mysql2 | 3.24.4 | 2026-09-08 | >= 8.0 | active (daily canaries) |
| mariadb | 3.5.4 | 2026-09-01 | >= 20 | active; also back-publishes 3.2.x/3.3.x/3.4.x patch lines |
| tedious | 20.3.0 | 2026-09-06 | >= 22 | active (five releases in the first week of Sept 2026, https://github.com/tediousjs/tedious/releases). The repo pins ^18; v20 requires Node >= 22 |
| sqlite3 | 6.0.1 | 2026-03-12 | >= 20.17 | repository archived. README (https://github.com/TryGhost/node-sqlite3): "This repository is currently unmaintained. We will not update any of its issues or pull requests." (archived 2026-07-01). Prebuilt binaries: darwin/linux/linux-musl x64 and arm64, win32 x64 |
| @vscode/sqlite3 | 5.1.14-vscode | 2026-06-26 | - | VS Code's maintained fork, referenced by the Sequelize docs |
| better-sqlite3 | 13.0.3 | 2026-08-05 | >= 22 | active |

Maintenance summary: pg, mysql2, mariadb and tedious are healthy. `sqlite3` is the risk: the upstream repository is archived and no fixes will land. `@vscode/sqlite3` is the API-compatible fork that Sequelize itself points to.

## 7. Sequelize v6 (6.37.x) dialect and driver support

Sources:
- Constructor and dialect switch: https://github.com/sequelize/sequelize/blob/v6/src/sequelize.js
- Module loading: https://github.com/sequelize/sequelize/blob/v6/src/dialects/abstract/connection-manager.js
- SQLite connection manager: https://github.com/sequelize/sequelize/blob/v6/src/dialects/sqlite/connection-manager.js
- Deprecations: https://github.com/sequelize/sequelize/blob/v6/src/utils/deprecations.ts
- Engine minimums: https://github.com/sequelize/sequelize/blob/v6/ENGINE.md
- Docs: https://sequelize.org/docs/v6/getting-started/, https://sequelize.org/docs/v6/other-topics/dialect-specific-things/, https://sequelize.org/releases/
- npm: `npm view sequelize@6.37.8`

Findings:

- Latest v6 is 6.37.8 (dist-tag `latest`). v7 is `7.0.0-alpha.48` under `@sequelize/core`; v6 remains the current stable line per https://sequelize.org/releases/.
- Dialects in the v6 constructor switch: `mariadb`, `mssql`, `mysql`, `oracle`, `postgres`, `sqlite`, `db2`, `snowflake`. All five dialects used by this generator are first-class. None is deprecated: the only deprecation codes in v6 are SEQUELIZE0002 (logging true), 0003 (string operators), 0004 (boolean operatorsAliases), 0005 (double nested group) and 0006 `unsupportedEngine` ("This database engine version is not supported, please update your database server"), which is a runtime warning about the server version, not a dialect deprecation. Snowflake is the only dialect the docs mark "Experimental".
- Optional peer dependencies of 6.37.8 (from `peerDependenciesMeta`): `pg`, `pg-hstore`, `mysql2`, `mariadb`, `sqlite3`, `tedious`, `oracledb`, `ibm_db`, `snowflake-sdk`. Drivers must be installed manually in v6.
- Minimum engine versions (ENGINE.md, v6): PostgreSQL 9.5.0, MySQL 5.7.0, MariaDB 10.1.44, SQL Server 2014 Express, SQLite 3.8.0, DB2 11.5. The releases page lists v6 as tested against Postgres >= 9.5, MySQL ^5.7 and ^8.0, MariaDB >= 10.3, MSSQL 2014 to 2019, with driver floors pg >= 8.2 (Node >= 14), mysql2 >= 2.3.3, mariadb ^2.3.3, tedious ^8.3.0, sqlite3 ^5.0.3 or @vscode/sqlite3 ^4.0.12. MySQL 8.4/9.7/26.7, MariaDB 11.x/12.x and SQL Server 2022/2025 are newer than what the v6 support table names; they work in practice (this repo's tests already run on `mysql:8` -> 8.4, `mariadb:11`, and `2022-latest`) but are outside the documented v6 test matrix.
- SQLite driver: v6 hard-codes `this._loadDialectModule('sqlite3')` and drives it through the node-sqlite3 callback API (`new Database(...)`, `.run/.all/.serialize`). `_loadDialectModule` honours two options, `dialectModulePath` (a path to `require`) and `dialectModule` (a pre-loaded module object), but whatever is injected must expose the node-sqlite3 API. `@vscode/sqlite3` is API-compatible and is what the dialect docs recommend "due to security concerns with sqlite3@^4". `better-sqlite3` (synchronous, different API) and `node:sqlite` (also a different API; still "Stability: 1.2 - Release candidate" in the Node docs, https://nodejs.org/api/sqlite.html, added v22.5.0, unflagged in v22.13.0/v23.4.0, RC since v25.7.0) are not supported by Sequelize v6 and there is no adapter for them in the v6 tree.
- Sequelize v7 (alpha) also stays on node-sqlite3, packaged as `@sequelize/sqlite3` (https://sequelize.org/docs/v7/databases/sqlite/); it offers no better-sqlite3 or node:sqlite dialect either.

## 8. Recommendations for this repository

1. Postgres: bump the default tag to `postgres:18`; keep `14` as the oldest-supported target in any matrix (drop it after 2026-11-12).
2. MySQL: pin explicitly to `mysql:9.7` (or `mysql:lts`) and `mysql:8.4` instead of the moving `8` tag; drop 8.0 (Sustaining Support). Optionally smoke-test `mysql:innovation` (26.7).
3. MariaDB: pin `mariadb:12.3` (or `mariadb:lts`) and `mariadb:10.11`; `10.6` is past community EOL.
4. SQL Server: move the default to `2025-latest`; keep `2017-latest` as oldest-supported. Keep `--platform=linux/amd64`; there is no arm64 image and Microsoft does not support emulation, so document that mssql tests on Apple Silicon are best-effort.
5. Drivers: bump `tedious` to ^20 only once the project's minimum Node is >= 22 (v20 requires it); keep `pg`, `mysql2`, `mariadb` on latest. Replace `sqlite3` with `@vscode/sqlite3` via `dialectModule`, or keep `sqlite3@6.0.1` knowing upstream is archived. Do not plan on better-sqlite3 or node:sqlite for Sequelize v6.
6. No Sequelize 6.37.x dialect changes are required: all five dialects are supported and undeprecated.
