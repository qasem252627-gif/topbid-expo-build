CREATE INDEX `bids_auction_user_idx` ON `bids` (`auctionId`,`userId`);--> statement-breakpoint
CREATE INDEX `userPushTokens_userId_idx` ON `userPushTokens` (`userId`);