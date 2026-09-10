import { synthesizeSqliteConstraintName } from '../../dialects/DialectSQLite.js';

describe('synthesizeSqliteConstraintName', () => {
    it('uses the plain name for the first constraint on a column set', () => {
        const takenNames = new Set<string>();

        expect(synthesizeSqliteConstraintName('units', ['race_id'], 0, takenNames))
            .toBe('units_race_id_fkey');
    });

    it('joins composite source columns in order', () => {
        expect(synthesizeSqliteConstraintName('shipments', ['order_id', 'line_no'], 0, new Set()))
            .toBe('shipments_order_id_line_no_fkey');
    });

    it('appends the pragma id when the plain name is already taken', () => {
        const takenNames = new Set<string>(['units_race_id_fkey']);

        expect(synthesizeSqliteConstraintName('units', ['race_id'], 1, takenNames))
            .toBe('units_race_id_fkey_1');
    });
});
