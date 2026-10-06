-- Shared persistent rate-limit buckets and normalized global catalog records.
RENAME TABLE `publicOrderRateLimit` TO `publicApiRateLimit`;

CREATE TABLE `catalogCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    UNIQUE INDEX `catalogCategory_slug_key`(`slug`),
    INDEX `catalogCategory_sort_idx`(`sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `catalogFurniture` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `volume` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `step` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `weight` VARCHAR(64) NULL,
    `montagePrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `extraPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `demontage` BOOLEAN NOT NULL DEFAULT false,
    `notDismountable` BOOLEAN NOT NULL DEFAULT false,
    `bulky` BOOLEAN NOT NULL DEFAULT false,
    `montage` BOOLEAN NOT NULL DEFAULT false,
    `m100` BOOLEAN NOT NULL DEFAULT false,
    `m150` BOOLEAN NOT NULL DEFAULT false,
    INDEX `catalogFurniture_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `catalogFurnitureCategory` (
    `furnitureId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    INDEX `catalogFurnitureCategory_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`furnitureId`, `categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `catalogService` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `show` BOOLEAN NOT NULL DEFAULT true,
    INDEX `catalogService_sort_idx`(`sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `catalogPacking` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `description` TEXT NOT NULL,
    `media` VARCHAR(2048) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `show` BOOLEAN NOT NULL DEFAULT true,
    INDEX `catalogPacking_sort_idx`(`sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `catalogOffer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `workers` INTEGER NOT NULL,
    `trucks` INTEGER NOT NULL,
    `includedHours` INTEGER NOT NULL,
    `sum` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `hourPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `ridingCosts` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,
    UNIQUE INDEX `catalogOffer_trucks_workers_includedHours_key`(`trucks`, `workers`, `includedHours`),
    INDEX `catalogOffer_sort_idx`(`sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `catalogServiceRate` (
    `key` VARCHAR(64) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `catalogFurnitureCategory`
    ADD CONSTRAINT `catalogFurnitureCategory_furnitureId_fkey`
    FOREIGN KEY (`furnitureId`) REFERENCES `catalogFurniture`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `catalogFurnitureCategory`
    ADD CONSTRAINT `catalogFurnitureCategory_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `catalogCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `catalogServiceRate` (`key`, `price`) VALUES
    ('aBettDeMon', 0),
    ('aBoxPack', 0),
    ('acbm', 0),
    ('aetage', 0),
    ('akitmon', 0),
    ('ameter', 0),
    ('awardmon', 0),
    ('disposalBasicPrice', 0),
    ('disposalCbmPrice', 0),
    ('kmPrice', 0),
    ('hvzPrice', 0);
