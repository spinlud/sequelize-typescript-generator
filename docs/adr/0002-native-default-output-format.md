# 0002. Native default output format

- Status: Accepted
- Date: 2026-09-10

## Context

Every version before 13 emitted a single output style: `sequelize-typescript`
decorated classes, which require the consuming project to install
`sequelize-typescript` and `reflect-metadata`. Version 13 (issue #80) adds a
framework-free native emitter that produces plain `sequelize` classes: attributes
typed with `InferAttributes` / `InferCreationAttributes`, `declare`d fields wrapped
with `CreationOptional`, `ForeignKey` and `NonAttribute`, a `static initModel`
method per model, and an `initModels` wiring file plus an `index.ts` barrel. With
two formats available the generator needs a default.

## Decision

Make the native format the default:

- `--format native` is the default; `--format decorators` is opt-in.
- The programmatic `IConfig.format` option defaults to `'native'` when unset.
- `strict` applies to the decorators format only. It is ignored under native, where
  attributes are always typed with `InferAttributes`; combining `--no-strict` with
  native prints a notice and does nothing else.

## Consequences

- Breaking change for existing consumers: anyone relying on the previous decorators
  output must now pass `--format decorators` (or set `format: 'decorators'`).
- Native models depend on `sequelize` alone; `sequelize-typescript` and
  `reflect-metadata` are needed only for the decorators format. When the decorators
  format is selected and `sequelize-typescript` cannot be resolved from the output
  directory, a warning is emitted; the generator never throws for this.
- SQLite-specific quirk: SQLite reports `notnull=0` for an integer rowid primary
  key, so native types such a primary key as `CreationOptional<number | null>`. The
  init options stay correct (`primaryKey` and `autoIncrement` set, `allowNull`
  omitted). Dialects that report `notnull=1` for their generated primary key emit
  `CreationOptional<number>`.

See issue #80 and `docs/plans/v13-phase6-native-emitter.md`.
