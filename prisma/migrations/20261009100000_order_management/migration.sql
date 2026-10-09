ALTER TABLE `order`
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    ADD COLUMN `edited` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `purgeAt` DATETIME(3) NULL,
    ADD COLUMN `originOrderId` VARCHAR(191) NULL,
    ADD INDEX `order_archivedAt_purgeAt_idx`(`archivedAt`, `purgeAt`),
    ADD INDEX `order_originOrderId_idx`(`originOrderId`);

CREATE TABLE `orderActivityEvent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(32) NOT NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `orderActivityEvent_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `orderActivityEvent` ADD CONSTRAINT `orderActivityEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `order` ADD CONSTRAINT `order_originOrderId_fkey` FOREIGN KEY (`originOrderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
