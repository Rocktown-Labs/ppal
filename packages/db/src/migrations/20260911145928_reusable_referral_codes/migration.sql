ALTER TABLE `user` ADD `referral_code` text;
UPDATE `user`
SET `referral_code` = (
  SELECT `code` FROM `referrals`
  WHERE `referrals`.`referrer_user_id` = `user`.`id`
  ORDER BY `referrals`.`created_at` LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM `referrals`
  WHERE `referrals`.`referrer_user_id` = `user`.`id`
);
DELETE FROM `referrals` WHERE `referred_user_id` IS NULL;
DROP INDEX `referrals_code_unique`;
CREATE UNIQUE INDEX `user_referral_code_uidx` ON `user` (`referral_code`);
CREATE INDEX `referrals_code_created_idx` ON `referrals` (`code`,`created_at`);
