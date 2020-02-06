export const INDICES_TABLE_NAME = 'indices';
export const INDICES_TABLE_DROP = `DROP TABLE ${INDICES_TABLE_NAME}`;
export const INDICES_TABLE_CREATE = `
    CREATE TABLE ${INDICES_TABLE_NAME}
    (
        id INTEGER      CONSTRAINT indices_pk       PRIMARY KEY         AUTOINCREMENT,
        f_unique INTEGER not null,
        f_multi_1 INTEGER,
        f_multi_2 VARCHAR(80),
        f_not_unique INTEGER
    );
`;

export const INDICES_TABLE_CREATE_INDEX_1 = `
    CREATE UNIQUE INDEX indices_f_multi_1_f_multi_2_uindex
        ON ${INDICES_TABLE_NAME} (f_multi_1, f_multi_2);
`;

export const INDICES_TABLE_CREATE_INDEX_2 = `
    CREATE UNIQUE INDEX indices_f_multi_1_uindex
        ON ${INDICES_TABLE_NAME} (f_multi_1);
`;

export const INDICES_TABLE_CREATE_INDEX_3 = `
    CREATE INDEX indices_f_not_unique_index
        ON ${INDICES_TABLE_NAME} (f_not_unique);
`;

export const INDICES_TABLE_CREATE_INDEX_4 = `
    CREATE UNIQUE INDEX indices_f_unique_uindex
        ON ${INDICES_TABLE_NAME} (f_unique);
`;
