ALTER TABLE `currencySettings` ADD `deliveryFeeAmount` decimal(12,2) DEFAULT '2.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `currencySettings` ADD `deliveryFeeCurrency` enum('IQD','USD') DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `governorate` varchar(32);