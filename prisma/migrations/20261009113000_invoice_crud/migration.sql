CREATE TABLE `invoice` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(64) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `orderNumberSnapshot` INTEGER NULL,
    `customerNameSnapshot` VARCHAR(300) NOT NULL,
    `company` VARCHAR(191) NOT NULL DEFAULT '',
    `customerStreet` VARCHAR(191) NOT NULL DEFAULT '',
    `customerPostalCity` VARCHAR(191) NOT NULL DEFAULT '',
    `invoiceDate` DATETIME(3) NOT NULL,
    `taxPercent` DECIMAL(5, 2) NOT NULL DEFAULT 19,
    `text` TEXT NOT NULL,
    `entries` JSON NOT NULL,
    `dueDates` JSON NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `purgeAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoice_invoiceNumber_key`(`invoiceNumber`),
    UNIQUE INDEX `invoice_orderId_key`(`orderId`),
    INDEX `invoice_orderNumberSnapshot_idx`(`orderNumberSnapshot`),
    INDEX `invoice_customerNameSnapshot_idx`(`customerNameSnapshot`),
    INDEX `invoice_archivedAt_purgeAt_idx`(`archivedAt`, `purgeAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `invoiceNumberSequence` (`id` INTEGER NOT NULL, `nextValue` INTEGER NOT NULL, PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `invoiceNumberSequence` (`id`, `nextValue`) VALUES (1, 1);
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
