ALTER TABLE `orderImage` DROP INDEX `orderImage_objectKey_key`;
CREATE INDEX `orderImage_objectKey_idx` ON `orderImage`(`objectKey`);
