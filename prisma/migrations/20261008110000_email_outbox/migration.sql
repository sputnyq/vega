CREATE TABLE `emailOutbox` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `kind` VARCHAR(32) NOT NULL,
    `recipients` JSON NOT NULL,
    `subject` VARCHAR(998) NOT NULL,
    `contentHtml` LONGTEXT NOT NULL,
    `attachments` JSON NULL,
    `actorName` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL,
    `lockedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `lastErrorCode` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `emailOutbox_idempotencyKey_key`(`idempotencyKey`),
    INDEX `emailOutbox_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `emailOutbox_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `emailEvent` (
    `id` VARCHAR(191) NOT NULL,
    `outboxId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `kind` VARCHAR(32) NOT NULL,
    `actorName` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `emailEvent_outboxId_key`(`outboxId`),
    INDEX `emailEvent_orderId_idx`(`orderId`),
    INDEX `emailEvent_sentAt_idx`(`sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `emailOutbox` ADD CONSTRAINT `emailOutbox_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `emailEvent` ADD CONSTRAINT `emailEvent_outboxId_fkey` FOREIGN KEY (`outboxId`) REFERENCES `emailOutbox`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `emailEvent` ADD CONSTRAINT `emailEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
