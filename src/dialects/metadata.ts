export interface ITableMetadata {
    name: string;
    columns: IColumnMetadata[];
}

export interface IColumnMetadata {
    name: string;
    type: string;
    typeExt: string;
    // dataType: DataType;
    primaryKey: boolean;
    // foreignKey: boolean;
    allowNull: boolean;
    // unique: boolean;
    autoIncrement: boolean;
    // default?: ;
}
