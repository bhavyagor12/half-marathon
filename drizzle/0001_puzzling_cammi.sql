CREATE TABLE `refund_jobs` (
	`payment` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount` integer,
	`fee` integer,
	`refund_id` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `expected_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `previous_id` text;--> statement-breakpoint
ALTER TABLE `slots` ADD `owner_id` text;--> statement-breakpoint
ALTER TABLE `slots` ADD `version` integer DEFAULT 0 NOT NULL;