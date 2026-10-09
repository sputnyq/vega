CREATE TABLE `orderImage` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `objectKey` VARCHAR(191) NOT NULL,
  `size` INTEGER NOT NULL,
  `generation` VARCHAR(64) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `verifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `orderId` VARCHAR(191) NULL,
  UNIQUE INDEX `orderImage_objectKey_key` (`objectKey`),
  INDEX `orderImage_orderId_idx` (`orderId`),
  INDEX `orderImage_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `orderImage_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
