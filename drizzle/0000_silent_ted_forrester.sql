CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`slot` integer NOT NULL,
	`amount` integer NOT NULL,
	`brand` text NOT NULL,
	`tagline` text NOT NULL,
	`website` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`session` text,
	`checkout_url` text,
	`payment` text,
	`logo` text,
	`expires` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_payment_unique` ON `orders` (`payment`);--> statement-breakpoint
CREATE TABLE `slots` (
	`id` integer PRIMARY KEY NOT NULL,
	`order_id` text,
	`reserved_until` integer DEFAULT 0 NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL
);
