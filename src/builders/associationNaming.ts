import pluralize from 'pluralize';
import type { IAssociationMetadata } from '../dialects/AssociationsParser.js';

/**
 * Resolve the class property name an association is exposed under. When the
 * association carries a discovered alias it wins; otherwise the target model
 * name is pluralized for to-many associations and singularized otherwise.
 * @param {IAssociationMetadata} association
 * @returns {string}
 */
export const resolveAssociationPropertyName = (association: IAssociationMetadata): string => {
    if (association.alias) {
        return association.alias;
    }

    return association.associationName.includes('Many') ?
        pluralize.plural(association.targetModel) : pluralize.singular(association.targetModel);
};
