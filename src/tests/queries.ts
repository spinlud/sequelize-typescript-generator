export const ordersTable = 'orders';

export const ordersTableQuery = `
    create table orders
    (
        order_id bigint unsigned auto_increment primary key,
        order_public_id varchar(32) not null,
        opened_at timestamp default CURRENT_TIMESTAMP not null comment 'when this order has been opened',
        updated_at timestamp default CURRENT_TIMESTAMP not null comment 'when this order has been updated last time',
        closed_at timestamp null comment 'when this order has been closed, if closed',
        accountable bit default b'0' not null comment 'whether this order should be automatically invoiced no matter the payments status',
        is_renew bit default b'0' not null comment 'whether this order is about renewing assets or purchasing them',
        deleted bit default b'0' not null comment 'whether this order has been deleted',
        constraint orders_order_public_id_uindex
        unique (order_public_id)
    )
    charset=latin1
`;

export const orderItemsTable = 'order_items';

export const orderItemsTableQuery = `
    create table order_items
    (
        order_item_id bigint unsigned auto_increment primary key,
        order_item_public_id varchar(32) not null,
        order_id bigint unsigned not null comment 'to which order this entry refers to',
        asset_variant_id bigint unsigned not null comment 'to which asset variant this entry refers to',
        ordered_at timestamp default CURRENT_TIMESTAMP not null comment 'when this asset variant has been added to the order',
        deleted_at timestamp null comment 'when this asset variant has been removed from the order, if it was removed',
        quantity int(11) unsigned default 1 not null comment 'how many (bundles of) items are included in this order entry',
        bundle_price decimal(10,5) unsigned not null comment 'unit price for a bundle of the asset variant',
        bundle_size int(11) unsigned default 1 not null comment 'how many assets, of this asset variant, composes up this bundle',
        has_limited_lifecycle bit default b'1' not null comment 'whether this asset is sold/valid for a specific window of time (1) or is valid forever (0)',
        lifecycle_units int(11) unsigned null comment 'how many time-units this item is sold for',
        lifecycle_unit varchar(16) null comment 'in which unit is expressed the field lifecycle_units (can be "day", "week", "month", "year", etc)',
        discount_id bigint unsigned null comment 'which discount, if any, is applied to this asset variant in the context of this order',
        tax_applies bit default b'0' not null comment 'whether tax fees apply to this order and this asset',
        tax_percent decimal(10,5) unsigned null comment 'if tax_applies is set, this indicates the percentage of tax applied to the asset variant''s unit price (e.g. 23)',
        deleted bit default b'0' not null comment 'whether this asset variant has been removed from the order at some point',
        constraint order_items_order_item_public_id_uindex
        unique (order_item_public_id)
    )
    comment 'to relate assets with orders' charset=latin1;
`;
