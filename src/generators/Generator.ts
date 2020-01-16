import { ITableMetadata, Dialect } from '../dialects';

export abstract class Generator {
    protected dialect: Dialect;

    protected constructor(dialect: Dialect) {
        this.dialect = dialect;
    }

    abstract async generate(tableMetadata: ITableMetadata): Promise<string>;
}
