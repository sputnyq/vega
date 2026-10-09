ALTER TABLE `user` ADD COLUMN `blocked` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `user_role_blocked_idx` ON `user` (`role`, `blocked`);
