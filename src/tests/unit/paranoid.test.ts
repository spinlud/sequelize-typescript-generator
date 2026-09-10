import { findParanoidColumn, resolveParanoidOption } from '../../dialects/paranoid.js';
import { IColumnMetadata } from '../../dialects/Dialect.js';

const buildColumn = (originName: string): IColumnMetadata => ({
    name: originName,
    originName,
    type: 'timestamp',
    typeExt: 'timestamp',
    primaryKey: false,
    allowNull: true,
    autoIncrement: false,
});

describe('paranoid helpers', () => {

    describe('findParanoidColumn', () => {
        it('matches deleted_at, deletedAt and DELETED_AT case-insensitively', () => {
            expect(findParanoidColumn([buildColumn('id'), buildColumn('deleted_at')])?.originName).toBe('deleted_at');
            expect(findParanoidColumn([buildColumn('deletedAt')])?.originName).toBe('deletedAt');
            expect(findParanoidColumn([buildColumn('DELETED_AT')])?.originName).toBe('DELETED_AT');
        });

        it('returns undefined when no soft-delete column is present', () => {
            expect(findParanoidColumn([buildColumn('id'), buildColumn('name')])).toBeUndefined();
        });
    });

    describe('resolveParanoidOption', () => {
        it('warns and disables when timestamps are missing', () => {
            const resolution = resolveParanoidOption({ paranoid: true });

            expect(resolution.enabled).toBe(false);
            expect(resolution.warning).toBeDefined();
        });

        it('enables without warning when timestamps are present', () => {
            const resolution = resolveParanoidOption({ paranoid: true, timestamps: true });

            expect(resolution.enabled).toBe(true);
            expect(resolution.warning).toBeUndefined();
        });

        it('is disabled without warning when paranoid is not requested', () => {
            expect(resolveParanoidOption({})).toEqual({ enabled: false });
            expect(resolveParanoidOption(undefined)).toEqual({ enabled: false });
        });
    });

});
