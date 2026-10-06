CREATE TABLE `order` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` INTEGER NOT NULL,
    `customerName` VARCHAR(300) NOT NULL,
    `customerEmail` VARCHAR(254) NULL,
    `customerPhone` VARCHAR(64) NOT NULL,
    `source` VARCHAR(32) NOT NULL,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `order_orderNumber_key`(`orderNumber`),
    INDEX `order_customerName_idx`(`customerName`),
    INDEX `order_customerEmail_idx`(`customerEmail`),
    INDEX `order_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `publicOrderRateLimit` (
    `key` VARCHAR(191) NOT NULL,
    `windowStartedAt` DATETIME(3) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    INDEX `publicOrderRateLimit_windowStartedAt_idx`(`windowStartedAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `orderNumberSequence` (
    `id` INTEGER NOT NULL,
    `nextValue` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `orderNumberSequence` (`id`, `nextValue`) VALUES (1, 1000);
