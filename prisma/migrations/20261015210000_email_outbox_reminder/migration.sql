-- AlterTable
ALTER TABLE `emailOutbox` ADD COLUMN `reminderEventId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `emailOutbox_reminderEventId_idx` ON `emailOutbox`(`reminderEventId`);

-- AddForeignKey
ALTER TABLE `emailOutbox` ADD CONSTRAINT `emailOutbox_reminderEventId_fkey` FOREIGN KEY (`reminderEventId`) REFERENCES `reminderEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
