CREATE TABLE `auctionGalleryImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`imageKey` varchar(255) NOT NULL,
	`position` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auctionGalleryImages_id` PRIMARY KEY(`id`),
	CONSTRAINT `auctionGalleryImages_auction_position_uq` UNIQUE(`auctionId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `deliveryConfirmations` (
	`auctionId` int NOT NULL,
	`userId` int NOT NULL,
	`confirmedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deliveryConfirmations_auctionId` PRIMARY KEY(`auctionId`)
);
--> statement-breakpoint
CREATE TABLE `phoneOtpChallenges` (
	`userId` int NOT NULL,
	`phone` varchar(32) NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 1,
	`windowStartedAt` timestamp NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`resendAfter` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `phoneOtpChallenges_userId` PRIMARY KEY(`userId`),
	CONSTRAINT `phoneOtpChallenges_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `verifiedPhoneNumbers` (
	`userId` int NOT NULL,
	`phone` varchar(32) NOT NULL,
	`verifiedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verifiedPhoneNumbers_userId` PRIMARY KEY(`userId`),
	CONSTRAINT `verifiedPhoneNumbers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
ALTER TABLE `auctions` MODIFY COLUMN `status` enum('active','ended','cancelled') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `users` ADD `phoneVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `auctionGalleryImages` ADD CONSTRAINT `auctionGalleryImages_auctionId_auctions_id_fk` FOREIGN KEY (`auctionId`) REFERENCES `auctions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliveryConfirmations` ADD CONSTRAINT `deliveryConfirmations_auctionId_auctions_id_fk` FOREIGN KEY (`auctionId`) REFERENCES `auctions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliveryConfirmations` ADD CONSTRAINT `deliveryConfirmations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `phoneOtpChallenges` ADD CONSTRAINT `phoneOtpChallenges_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verifiedPhoneNumbers` ADD CONSTRAINT `verifiedPhoneNumbers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auctionGalleryImages_auctionId_idx` ON `auctionGalleryImages` (`auctionId`);--> statement-breakpoint
CREATE INDEX `deliveryConfirmations_userId_idx` ON `deliveryConfirmations` (`userId`);