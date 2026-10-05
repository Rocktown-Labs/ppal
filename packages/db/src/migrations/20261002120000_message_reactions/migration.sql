CREATE TABLE `community_message_reactions` (
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `emoji` text NOT NULL,
  `message_id` text NOT NULL REFERENCES `community_messages`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  CONSTRAINT `community_message_reactions_emoji_length_check` CHECK (length(`community_message_reactions`.`emoji`) BETWEEN 1 AND 16),
  PRIMARY KEY (`message_id`, `user_id`, `emoji`)
);
CREATE INDEX `community_message_reactions_message_idx` ON `community_message_reactions` (`message_id`, `emoji`);
