export { Dialect } from './dialects/Dialect.js';
export type {
    DialectName,
    ITablesMetadata,
    ITableMetadata,
    IColumnMetadata,
    IIndexMetadata,
    ITable,
    IColumnForeignKeyMetadata,
    IForeignKeyConstraintMetadata,
} from './dialects/Dialect.js';
export { createDialect } from './dialects/createDialect.js';
export type { ReferentialAction } from './dialects/foreignKeys.js';
export type { ISequelizeDataType, SequelizeDataTypeKey } from './dialects/dataTypes.js';
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

export { FORMATS, DEFAULT_FORMAT, isFormat } from './config/format.js';
export type { Format } from './config/format.js';
