-- AlterTable
ALTER TABLE `user` ADD COLUMN `signatureName` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `emailOutbox` ADD COLUMN `signatureName` VARCHAR(100) NULL;
