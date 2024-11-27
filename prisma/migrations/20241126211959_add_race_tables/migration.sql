-- CreateTable
CREATE TABLE `Race` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'COUNTDOWN', 'RACING', 'PAUSED', 'FINISHED', 'STOPPED') NOT NULL DEFAULT 'PENDING',
    `startDelay` INTEGER NOT NULL,
    `totalLaps` INTEGER NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Race_locationId_idx`(`locationId`),
    INDEX `Race_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RaceEntry` (
    `id` VARCHAR(191) NOT NULL,
    `raceId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `carId` VARCHAR(191) NOT NULL,
    `carNumber` INTEGER NOT NULL,
    `position` INTEGER NULL,
    `lapsCompleted` INTEGER NOT NULL DEFAULT 0,
    `bestLapTime` INTEGER NULL,
    `totalTime` INTEGER NULL,
    `status` ENUM('REGISTERED', 'RACING', 'FINISHED', 'DNF') NOT NULL DEFAULT 'REGISTERED',
    `dnfReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RaceEntry_raceId_idx`(`raceId`),
    INDEX `RaceEntry_driverId_idx`(`driverId`),
    INDEX `RaceEntry_carId_idx`(`carId`),
    INDEX `RaceEntry_status_idx`(`status`),
    UNIQUE INDEX `RaceEntry_raceId_carNumber_key`(`raceId`, `carNumber`),
    UNIQUE INDEX `RaceEntry_raceId_driverId_key`(`raceId`, `driverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RaceLap` (
    `id` VARCHAR(191) NOT NULL,
    `raceEntryId` VARCHAR(191) NOT NULL,
    `lapNumber` INTEGER NOT NULL,
    `lapTime` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `gap` INTEGER NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RaceLap_raceEntryId_idx`(`raceEntryId`),
    UNIQUE INDEX `RaceLap_raceEntryId_lapNumber_key`(`raceEntryId`, `lapNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Race` ADD CONSTRAINT `Race_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RaceEntry` ADD CONSTRAINT `RaceEntry_raceId_fkey` FOREIGN KEY (`raceId`) REFERENCES `Race`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RaceEntry` ADD CONSTRAINT `RaceEntry_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RaceEntry` ADD CONSTRAINT `RaceEntry_carId_fkey` FOREIGN KEY (`carId`) REFERENCES `Car`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RaceLap` ADD CONSTRAINT `RaceLap_raceEntryId_fkey` FOREIGN KEY (`raceEntryId`) REFERENCES `RaceEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
