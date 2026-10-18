CREATE TABLE `auctions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`titleAr` varchar(180) NOT NULL,
	`titleEn` varchar(180) NOT NULL,
	`titleKu` varchar(180) NOT NULL,
	`descriptionAr` text NOT NULL,
	`descriptionEn` text NOT NULL,
	`descriptionKu` text NOT NULL,
	`category` enum('electronics','home') NOT NULL,
	`imageKey` varchar(80) NOT NULL,
	`currency` enum('IQD','USD') NOT NULL,
	`startingPrice` decimal(14,2) NOT NULL,
	`currentPrice` decimal(14,2) NOT NULL,
	`minIncrement` decimal(12,2) NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('active','ended') NOT NULL DEFAULT 'active',
	`sellerOpenId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auctions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auctions_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `bids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(128) NOT NULL;