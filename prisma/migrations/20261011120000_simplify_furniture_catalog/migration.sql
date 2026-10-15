UPDATE `catalogFurniture` SET `step` = 1 WHERE `step` IS NULL;

ALTER TABLE `catalogFurniture`
    MODIFY `step` INTEGER NOT NULL DEFAULT 1,
    DROP COLUMN `weight`,
    DROP COLUMN `montagePrice`,
    DROP COLUMN `extraPrice`,
    DROP COLUMN `demontage`,
    DROP COLUMN `notDismountable`,
    DROP COLUMN `bulky`,
    DROP COLUMN `montage`,
    DROP COLUMN `m100`,
    DROP COLUMN `m150`;