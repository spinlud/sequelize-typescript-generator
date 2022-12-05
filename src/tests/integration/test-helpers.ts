import { AssociationType, IAssociationsParsed } from '../../dialects/AssociationsParser';

export const getAssociationCustomPropName = (
  parsedAssociations: IAssociationsParsed, 
  tableNameOfModelReferencedByProp: string,
  assocationType: AssociationType,
  tableNameOfModelOwningProp: string,
  foreignKey?: string
) => {
  const assocs = parsedAssociations![tableNameOfModelReferencedByProp].associations;
  const assoc = assocs.find(a => 
        a.associationName == assocationType &&
        a.targetModel.fullTableName == tableNameOfModelOwningProp &&
        (!foreignKey || a.targetKey == foreignKey)
    );
  return assoc;
};