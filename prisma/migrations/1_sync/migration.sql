-- CreateTable
CREATE TABLE `Tombstone` (
    `kind` VARCHAR(191) NOT NULL,
    `recordId` VARCHAR(191) NOT NULL,
    `deletedAt` DATETIME(3) NOT NULL,

    INDEX `Tombstone_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`kind`, `recordId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IdAlias` (
    `kind` VARCHAR(191) NOT NULL,
    `fromId` VARCHAR(191) NOT NULL,
    `toId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`kind`, `fromId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncMeta` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

