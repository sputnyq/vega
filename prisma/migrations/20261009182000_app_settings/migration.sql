CREATE TABLE `appSettings` (
  `id` INTEGER NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 0,
  `boxCbm` DECIMAL(10,4) NULL,
  `kleiderboxCbm` DECIMAL(10,4) NULL,
  `origin` VARCHAR(300) NULL,
  `dataPrivacyUrl` VARCHAR(2048) NULL,
  `successUrl` VARCHAR(2048) NULL,
  `boxCalculatorUrl` VARCHAR(2048) NULL,
  `companyEmail` VARCHAR(254) NULL,
  `emailFromName` VARCHAR(191) NULL,
  `emailFromAddress` VARCHAR(254) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `appSettings` (`id`, `revision`, `updatedAt`) VALUES (1, 0, CURRENT_TIMESTAMP(3));
