CREATE TABLE `orderAddress` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `role` ENUM('FROM', 'TO', 'SECONDARY_FROM', 'SECONDARY_TO') NOT NULL,
    `street` VARCHAR(160) NOT NULL,
    `postalCode` VARCHAR(16) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `details` JSON NOT NULL,
    INDEX `orderAddress_postalCode_city_idx`(`postalCode`, `city`),
    UNIQUE INDEX `orderAddress_orderId_role_key`(`orderId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `orderPosition` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `kind` ENUM('FURNITURE', 'SERVICE', 'PACKAGING') NOT NULL,
    `position` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `volume` DOUBLE NULL,
    `category` VARCHAR(191) NULL,
    `catalogId` INTEGER NULL,
    INDEX `orderPosition_catalogId_idx`(`catalogId`),
    UNIQUE INDEX `orderPosition_orderId_kind_position_key`(`orderId`, `kind`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `creditNote` (
    `id` VARCHAR(191) NOT NULL,
    `creditNumber` VARCHAR(64) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `invoiceNumberSnapshot` VARCHAR(64) NOT NULL,
    `orderNumberSnapshot` INTEGER NULL,
    `customerNameSnapshot` VARCHAR(300) NOT NULL,
    `company` VARCHAR(191) NOT NULL,
    `customerStreet` VARCHAR(191) NOT NULL,
    `customerPostalCity` VARCHAR(191) NOT NULL,
    `creditDate` DATETIME(3) NOT NULL,
    `taxPercent` DECIMAL(5, 2) NOT NULL,
    `text` TEXT NOT NULL,
    `entries` JSON NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `purgeAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `creditNote_creditNumber_key`(`creditNumber`),
    UNIQUE INDEX `creditNote_invoiceId_key`(`invoiceId`),
    INDEX `creditNote_invoiceNumberSnapshot_idx`(`invoiceNumberSnapshot`),
    INDEX `creditNote_orderNumberSnapshot_idx`(`orderNumberSnapshot`),
    INDEX `creditNote_customerNameSnapshot_idx`(`customerNameSnapshot`),
    INDEX `creditNote_archivedAt_purgeAt_idx`(`archivedAt`, `purgeAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reminderEvent` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `invoiceNumberSnapshot` VARCHAR(64) NOT NULL,
    `orderNumberSnapshot` INTEGER NULL,
    `customerNameSnapshot` VARCHAR(300) NOT NULL,
    `level` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `outstandingAmount` DECIMAL(12, 2) NOT NULL,
    `fee` DECIMAL(12, 2) NOT NULL,
    `text` TEXT NOT NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `purgeAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `reminderEvent_invoiceId_level_idx`(`invoiceId`, `level`),
    INDEX `reminderEvent_invoiceNumberSnapshot_idx`(`invoiceNumberSnapshot`),
    INDEX `reminderEvent_orderNumberSnapshot_idx`(`orderNumberSnapshot`),
    INDEX `reminderEvent_customerNameSnapshot_idx`(`customerNameSnapshot`),
    INDEX `reminderEvent_archivedAt_purgeAt_idx`(`archivedAt`, `purgeAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `orderAddress` ADD CONSTRAINT `orderAddress_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `orderPosition` ADD CONSTRAINT `orderPosition_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `creditNote` ADD CONSTRAINT `creditNote_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `reminderEvent` ADD CONSTRAINT `reminderEvent_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `emailEvent` DROP FOREIGN KEY `emailEvent_orderId_fkey`;
ALTER TABLE `emailEvent` DROP FOREIGN KEY `emailEvent_outboxId_fkey`;
ALTER TABLE `emailOutbox` DROP FOREIGN KEY `emailOutbox_orderId_fkey`;
ALTER TABLE `emailOutbox` ADD CONSTRAINT `emailOutbox_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `emailEvent` ADD CONSTRAINT `emailEvent_outboxId_fkey` FOREIGN KEY (`outboxId`) REFERENCES `emailOutbox`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `emailEvent` ADD CONSTRAINT `emailEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve already-created Vega drafts; no legacy data is imported.
INSERT INTO `orderAddress` (`id`, `orderId`, `role`, `street`, `postalCode`, `city`, `details`)
SELECT UUID(), o.id, a.role,
       JSON_UNQUOTE(JSON_EXTRACT(o.data, CONCAT(a.path, '.street'))),
       JSON_UNQUOTE(JSON_EXTRACT(o.data, CONCAT(a.path, '.postalCode'))),
       JSON_UNQUOTE(JSON_EXTRACT(o.data, CONCAT(a.path, '.city'))),
       JSON_REMOVE(JSON_EXTRACT(o.data, a.path), '$.street', '$.postalCode', '$.city')
FROM `order` o
CROSS JOIN (
    SELECT 'FROM' AS role, '$.from' AS path
    UNION ALL SELECT 'TO', '$.to'
    UNION ALL SELECT 'SECONDARY_FROM', '$.details.secondaryFrom'
    UNION ALL SELECT 'SECONDARY_TO', '$.details.secondaryTo'
) a
WHERE JSON_TYPE(JSON_EXTRACT(o.data, a.path)) = 'OBJECT';

INSERT INTO `orderPosition` (`id`, `orderId`, `kind`, `position`, `name`, `quantity`, `volume`, `category`, `catalogId`)
SELECT UUID(), o.id, 'FURNITURE', p.position - 1, p.name, p.quantity, p.volume, p.category, p.catalogId
FROM `order` o,
JSON_TABLE(o.data, '$.details.furniture.items[*]' COLUMNS (
    position FOR ORDINALITY,
    name VARCHAR(191) PATH '$.name',
    quantity DOUBLE PATH '$.quantity',
    volume DOUBLE PATH '$.volume' NULL ON EMPTY,
    category VARCHAR(191) PATH '$.category' NULL ON EMPTY,
    catalogId INTEGER PATH '$.catalogId' NULL ON EMPTY
)) p;

INSERT INTO `orderPosition` (`id`, `orderId`, `kind`, `position`, `name`, `quantity`, `catalogId`)
SELECT UUID(), o.id, IF(p.kind = 'packaging', 'PACKAGING', 'SERVICE'), p.position - 1, p.name, p.quantity, p.catalogId
FROM `order` o,
JSON_TABLE(o.data, '$.details.extras.services[*]' COLUMNS (
    position FOR ORDINALITY,
    kind VARCHAR(16) PATH '$.kind',
    name VARCHAR(191) PATH '$.name',
    quantity DOUBLE PATH '$.quantity',
    catalogId INTEGER PATH '$.catalogId' NULL ON EMPTY
)) p;
