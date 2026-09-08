# THROWAWAY PROTOTYPE — native Sequelize v6 emitter (issue #68)

This directory is a **throwaway prototype** on branch `prototype/native-format`. It exists only to
answer one planning question. Do not merge it, do not build production code on it.

## The question

The current generator emits `sequelize-typescript` decorator models via the TypeScript compiler API
(`src/builders/ModelBuilder.ts`). We also want to emit **native Sequelize v6** models (the
`class X extends Model<InferAttributes<X>, InferCreationAttributes<X>>` + `declare` fields + `Model.init`
style, no decorators). Two questions:

1. Does staying on the compiler API produce readable, maintainable emitter code once we support **two**
   output formats, or is a **template** approach cheaper?
2. Rough effort estimate for the full native emitter.

## What this prototype builds

Two hand-written tables (`src/prototype-native/fixture.ts`) exercised through two emitters that must
produce **byte-for-byte identical** output:

- `authors`: `id` INTEGER autoincrement PK, `name` VARCHAR(255) NOT NULL. Has many `books`.
- `books`: `id` PK, `title` VARCHAR(255) NOT NULL, `subtitle` VARCHAR(255) nullable, `author_id`
  INTEGER FK → `authors.id`, `created_at`/`updated_at` timestamps, index `books_title_idx` on `title`.
  Belongs to `authors`.

Emitters:

- `emitterFactory.ts` — TypeScript compiler API (`ts.factory` + printer), structured like `ModelBuilder.ts`,
  reusing the repo's `nodeToString` and `generateNamedImports` helpers.
- `emitterTemplate.ts` — plain string-building functions per section, no template engine.
- `shared.ts` — pure metadata→descriptor logic used by **both** emitters (attribute classification,
  mixin lists, alias derivation, index grouping, import collection), so the diff isolates the
  code-emitting style rather than the metadata interpretation.

Both emit `Authors.ts`, `Books.ts`, `initModels.ts` in native format. `initModels(sequelize)` inits
every model, wires associations with `as` aliases, and returns them.

Generated evidence is committed under `output/factory/` and `output/template/`.

## How to run

```bash
npm run prototype:native
```

One command: emits both outputs, diffs them, type-checks the generated files with a strict
`tsc --noEmit` (`tsconfig.prototype.json`), then proves the generated code works — it loads the
generated `initModels` against an in-memory SQLite `Sequelize`, `sync()`s, inserts an author and a
book, and queries the book with `include` on the `author` association.

### Last observed run

```
[1] Diff factory vs template output:
  Authors.ts: IDENTICAL
  Books.ts: IDENTICAL
  initModels.ts: IDENTICAL
  => ALL IDENTICAL

[2] Type-check generated files:
  tsc --noEmit (strict): PASS

[3] Runtime proof (in-memory SQLite):
  query result: {"id":1,"title":"A Wizard of Earthsea","subtitle":null,"author_id":1,
                 "createdAt":"...","updatedAt":"...","author":{"id":1,"name":"Ursula K. Le Guin"}}
```

## Metadata gaps the real emitter must fill

The prototype reuses the repo's `ITableMetadata` / `IColumnMetadata` / `IAssociationMetadata`, but the
native format needs three things the current interfaces do not carry (added minimally in `fixture.ts`,
flagged here):

1. **FK reference target** — `IColumnMetadata.foreignKey` is only `{ name, targetModel }`. Native
   `references: { model, key }` needs the target **table** and **column**. The prototype extends it to
   `{ name, targetModel, targetTable, targetKey }`.
2. **Association wiring detail** — `IAssociationMetadata` has `associationName`, `targetModel`,
   `sourceKey`. Native wiring also needs the concrete `foreignKey` column and (for `BelongsTo`) the
   `targetKey`. Added as `foreignKey` / `targetKey` in the fixture.
3. **Native `DataTypes` expression** — the prototype stores the ready-made native expression in
   `dataType` (e.g. `DataTypes.STRING(255)`). The real emitter needs a db-type → `DataTypes.*` mapper
   analogous to the existing `mapDbTypeToJs`, because today `dataType` holds the `DataType.*`
   (sequelize-typescript) form.

## Measurements

### Lines of code (excluding blank lines and comments)

| File | Code LOC | Role |
| --- | --- | --- |
| `emitterFactory.ts` (compiler API) | **330** | produces the 3 files |
| `emitterTemplate.ts` (templates)   | **186** | produces the same 3 files |
| `shared.ts` (used by both)         | **132** | metadata→descriptors, identical for both |
| `fixture.ts`                       | 147 | hand-written metadata (not part of a real emitter) |
| `run.ts`                           | 120 | harness (diff + tsc + runtime proof) |

For identical output the compiler-API emitter is **~1.8× the code** of the template emitter, on top of
the same 132-line shared layer.

### Readability — how easy is it to see the shape of the output?

- **Template emitter**: you read the emitter almost like the target file. `` `declare ${name}: ${type};` ``
  and the `Model.init` block map one line of emitter to one line of output. A reviewer sees the shape
  immediately. Cost: indentation and commas are manual (the last-property-has-no-comma logic, the
  4-space levels), and a stray space would silently diverge — but that is exactly what the byte diff in
  `run.ts` catches.
- **Compiler-API emitter**: the shape is buried under `ts.factory.createX` trees. A single
  `declare id: CreationOptional<number>;` is `createPropertyDeclaration([DeclareKeyword], name, undefined,
  createTypeReferenceNode('CreationOptional', [createKeywordTypeNode(NumberKeyword)]), undefined)`. You
  cannot glance at the code and see the output; you reconstruct it in your head. In exchange you never
  think about commas, quotes or indentation — the printer is always syntactically correct.

### Which native features were painful, per approach

| Native feature | Compiler API | Templates |
| --- | --- | --- |
| `declare` fields | `DeclareKeyword` modifier — easy, but verbose | trivial (`declare ` prefix) |
| `Model<InferAttributes<X>, InferCreationAttributes<X>>` | `createExpressionWithTypeArguments` + nested `createTypeReferenceNode` — verbose but mechanical | trivial string interpolation |
| `T \| null` unions | `createUnionTypeNode([base, LiteralType(null)])` — fine | trivial |
| `ForeignKey<Authors['id']>` | `createIndexedAccessTypeNode` inside `createTypeReferenceNode` — the fiddliest node to assemble | trivial |
| nested `references: { model, key }` object literal | nested `createObjectLiteralExpression` / `createPropertyAssignment` — verbose; conditional props are clumsy | plain lines; conditional props are plain `if` pushes |
| `Model.init(attrs, options)` with conditional keys | many conditional `.push(createPropertyAssignment(...))` | many conditional `.push('...')` — same control flow, less noise per line |
| association mixin `declare`s (10 for hasMany) | one `createPropertyDeclaration` per mixin, mapped from `shared.ts` descriptors | one string per mixin, mapped from the same descriptors |
| `as` alias wiring in `initModels` | `createCallExpression` + `createPropertyAccessExpression` per association | one interpolated call per association |

The descriptor split (`shared.ts`) neutralised the genuinely hard part (deriving mixin names, aliases,
attribute kinds) for **both** approaches, so the remaining difference is purely rendering verbosity —
where templates win.

### What `ModelBuilder.ts` (decorators) needs to share code with a native emitter

- **Under the compiler API**: `ModelBuilder` and a native factory emitter can share the low-level utils
  (`nodeToString`, `generateNamedImports`) and, with the descriptor layer from this prototype, the
  metadata interpretation. But the *node trees differ completely* — a decorator model is
  `@Table … @Column(...) declare-less public fields`, a native model is `declare` fields + a `Model.init`
  method. There is almost no shareable node-construction code between the two formats; you would add a
  parallel set of `build*` functions, not reuse the existing ones. Net: the compiler-API decorator code
  is **not** a springboard for native — it's a second, independent factory tree.
- **Under templates**: same story but cheaper to stand up. The decorator emitter would be a separate set
  of string functions. The shareable part in either approach is the *metadata layer* (`shared.ts`-style
  descriptors), not the emitter.
- Practical implication: the two formats share **data**, not **rendering**. Whatever renderer we pick for
  native, the decorators format keeps its current compiler-API renderer; they meet at the metadata layer.

### Rough effort estimate for the full native emitter

Covering all existing flags (`--case`, `--timestamps`, `--indices`, `--tables`, `--skip-tables`,
`--no-views`, `--lint-file`, strict/non-strict) plus automatic 1:1 / 1:N association discovery.

Assumptions: one developer familiar with this codebase; the metadata pipeline, dialects, CLI parsing,
filtering (`--tables`/`--skip-tables`/`--no-views`) and linting are **reused unchanged** (they are
format-independent); "done" = feature parity with the decorator emitter for the four SQL dialects, unit
+ integration tests, and the three metadata gaps above filled; the full native attribute-typing matrix
(all `DataTypes`, ENUM unions, nullable/optional rules, `NonAttribute` getters, `belongsToMany` +
through models, self-associations) is in scope.

| Scope | (a) Compiler API | (b) Templates | (c) Hybrid: keep compiler API for decorators, templates for native |
| --- | --- | --- | --- |
| Native emitter core (models + `initModels`) | 4–5 d | 2.5–3 d | 2.5–3 d (native side is templates) |
| Full `DataTypes`/attribute-typing matrix + gaps 1–3 | 2–3 d | 2–3 d | 2–3 d (shared metadata layer) |
| Association discovery (1:1, 1:N; N:N + through) | 2–3 d | 2–3 d | 2–3 d (shared) |
| Flag wiring, strict/non-strict, tests, docs | 3–4 d | 3–4 d | 3–4 d |
| **Total** | **~11–15 dev-days** | **~9.5–13 dev-days** | **~10–13 dev-days** |

The format-independent work (association discovery, flags, the typing matrix, tests) dominates and is
the same in every column, so the headline totals are close. The compiler-API column is ~1.5–2 days
heavier purely from the renderer verbosity measured above, and that gap recurs on every future change
to the native output.

## Recommendation

**Use templates for the native format (option b/c), and keep the existing compiler API for the
decorators format (the hybrid, c).** Reasons:

1. **The two formats share data, not rendering.** The prototype shows the decorator factory code is not
   reusable for native output — you write a second renderer either way. So "stay on the compiler API for
   consistency" buys almost nothing, while costing ~1.8× the emitter LOC and much lower readability for
   the new format.
2. **Templates are self-evidently correct for this output.** Native models are flat, regular text
   (`declare` lines + one `init` object). The compiler API's main advantage — never producing
   syntactically invalid code — is cheaply matched here by a byte-diff test against a reference (already
   demonstrated: the two emitters are byte-identical and both type-check and run).
3. **Lower maintenance on the surface we'll touch most.** Every future tweak to native output (a new
   `DataTypes` case, a new option) is a one-line string change vs assembling a `ts.factory` subtree.
4. **No rewrite risk.** Keeping `ModelBuilder.ts` as-is means the decorators format is untouched; we only
   add a new template renderer beside it. Rewriting the working decorator emitter to templates is not
   worth the regression risk and is not required to ship native.

Trade-off accepted: templates require the byte-diff/`tsc` guard in CI to catch whitespace/quote drift.
The prototype already provides that harness pattern, so the cost is small and one-time.
