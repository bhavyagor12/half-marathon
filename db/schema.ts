import {integer,sqliteTable,text,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const orders=sqliteTable('orders',{
 id:text('id').primaryKey(),slot:integer('slot').notNull(),amount:integer('amount').notNull(),
 brand:text('brand').notNull(),tagline:text('tagline').notNull(),website:text('website').notNull(),
 tokenHash:text('token_hash').notNull(),status:text('status').notNull().default('pending'),
 expectedVersion:integer('expected_version').notNull().default(0),previousId:text('previous_id'),session:text('session'),checkoutUrl:text('checkout_url'),payment:text('payment'),logo:text('logo'),
 expires:integer('expires').notNull(),created:integer('created').notNull(),
},t=>[uniqueIndex('orders_payment_unique').on(t.payment)]);
export const slots=sqliteTable('slots',{id:integer('id').primaryKey(),orderId:text('order_id'),ownerId:text('owner_id'),version:integer('version').notNull().default(0),reservedUntil:integer('reserved_until').notNull().default(0),paid:integer('paid').notNull().default(0)});
export const limits=sqliteTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expires:integer('expires').notNull()});

export const refunds=sqliteTable('refund_jobs',{payment:text('payment').primaryKey(),orderId:text('order_id').notNull(),mode:text('mode').notNull(),status:text('status').notNull().default('pending'),amount:integer('amount'),fee:integer('fee'),refundId:text('refund_id'),created:integer('created').notNull()});
