CREATE TABLE `userPushTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`language` enum('ar','en','ku') NOT NULL DEFAULT 'ar',
	`platform` enum('android','ios') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userPushTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `userPushTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `userPushTokens` ADD CONSTRAINT `userPushTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;