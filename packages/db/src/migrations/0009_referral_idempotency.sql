ALTER TABLE `referrals` ADD `request_key` text;
CREATE UNIQUE INDEX `referrals_referrer_request_uidx` ON `referrals` (`referrer_user_id`,`request_key`);
