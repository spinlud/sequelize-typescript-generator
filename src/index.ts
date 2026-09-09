export { Dialect } from './dialects/Dialect.js';
export type {
    DialectName,
    ITablesMetadata,
    ITableMetadata,
    IColumnMetadata,
    IIndexMetadata,
} from './dialects/Dialect.js';
export { createDialect } from './dialects/createDialect.js';
export type { IAssociationMetadata } from './dialects/AssociationsParser.js';

export { ModelBuilder } from './builders/index.js';

export { TransformTarget, TransformCases } from './config/IConfig.js';
export type {
    IConfig,
    IConfigMetadata,
    IConfigOutput,
    TransformCase,
    TransformMap,
    TransformFn,
} from './config/IConfig.js';
