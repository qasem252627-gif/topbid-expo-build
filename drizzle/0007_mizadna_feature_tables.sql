CREATE TABLE `auctionFavorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`auctionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auctionFavorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `auctionFavorites_owner_auction_uq` UNIQUE(`userId`,`auctionId`)
);
--> statement-breakpoint
CREATE TABLE `currencySettings` (
	`id` int NOT NULL,
	`usdToIqd` int NOT NULL DEFAULT 1310,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `currencySettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
INSERT INTO `currencySettings` (`id`, `usdToIqd`) VALUES (1, 1310);
--> statement-breakpoint
CREATE TABLE `promotionalAds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imageKey` varchar(255) NOT NULL,
	`targetUrl` varchar(2048) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promotionalAds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `returnRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`auctionId` int NOT NULL,
	`reason` text NOT NULL,
	`imageKey` varchar(255) NOT NULL,
	`videoKey` varchar(255) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `returnRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `returnRequests_owner_auction_uq` UNIQUE(`userId`,`auctionId`)
);
--> statement-breakpoint
CREATE TABLE `supportConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supportConversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `supportConversations_userId_uq` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `supportMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderUserId` int NOT NULL,
	`senderRole` enum('user','admin') NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supportMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auctionFavorites` ADD CONSTRAINT `auctionFavorites_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auctionFavorites` ADD CONSTRAINT `auctionFavorites_auctionId_auctions_id_fk` FOREIGN KEY (`auctionId`) REFERENCES `auctions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotionalAds` ADD CONSTRAINT `promotionalAds_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `returnRequests` ADD CONSTRAINT `returnRequests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `returnRequests` ADD CONSTRAINT `returnRequests_auctionId_auctions_id_fk` FOREIGN KEY (`auctionId`) REFERENCES `auctions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supportConversations` ADD CONSTRAINT `supportConversations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supportMessages` ADD CONSTRAINT `supportMessages_conversationId_supportConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `supportConversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supportMessages` ADD CONSTRAINT `supportMessages_senderUserId_users_id_fk` FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auctionFavorites_userId_idx` ON `auctionFavorites` (`userId`);--> statement-breakpoint
CREATE INDEX `promotionalAds_active_id_idx` ON `promotionalAds` (`isActive`,`id`);--> statement-breakpoint
CREATE INDEX `returnRequests_status_created_idx` ON `returnRequests` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `supportConversations_lastMessage_idx` ON `supportConversations` (`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `supportMessages_conversation_created_idx` ON `supportMessages` (`conversationId`,`createdAt`);
