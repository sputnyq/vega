-- AlterTable
ALTER TABLE `emailOutbox` ADD COLUMN `optionOrderId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `emailOutbox_optionOrderId_idx` ON `emailOutbox`(`optionOrderId`);

-- AddForeignKey
ALTER TABLE `emailOutbox` ADD CONSTRAINT `emailOutbox_optionOrderId_fkey` FOREIGN KEY (`optionOrderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
