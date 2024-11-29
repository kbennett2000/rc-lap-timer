import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function PATCH(request: Request) {
  try {
    const data = await request.json();
    const { type, id, newName, defaultCarNumber } = data;

    if (type === "car") {
      const updatedCar = await prisma.car.update({
        where: { id },
        data: {
          name: newName,
          defaultCarNumber: defaultCarNumber || null,
        },
      });

      const updatedDrivers = await prisma.driver.findMany({
        include: { cars: true },
      });

      return NextResponse.json({
        success: true,
        car: updatedCar,
        updatedDrivers,
      });
    }

    if (type === "motionSetting") {
      // Existing motion settings code
      const existingSettings = await prisma.motionSettings.findFirst({
        where: {
          name: newName,
          id: { not: id },
        },
      });

      if (existingSettings) {
        return NextResponse.json({ error: "A motion setting with this name already exists" }, { status: 400 });
      }

      await prisma.motionSettings.update({
        where: { id },
        data: { name: newName },
      });

      return NextResponse.json({ success: true });
    }

    if (type === "location") {
      // Check if location name is already taken
      const existingLocation = await prisma.location.findFirst({
        where: {
          name: newName,
          id: { not: id },
        },
      });

      if (existingLocation) {
        return NextResponse.json({ error: "A location with this name already exists" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        // Update location name
        await tx.location.update({
          where: { id },
          data: { name: newName },
        });

        // Update locationName in all related sessions
        await tx.session.updateMany({
          where: { locationId: id },
          data: { locationName: newName },
        });
      });

      // Fetch updated data including locations
      const [updatedDrivers, updatedSessions, updatedLocations] = await Promise.all([
        prisma.driver.findMany({
          include: {
            cars: true,
            sessions: {
              include: {
                laps: true,
                penalties: true,
              },
            },
          },
        }),
        prisma.session.findMany({
          include: {
            laps: true,
            penalties: true,
          },
        }),
        prisma.location.findMany(),
      ]);

      return NextResponse.json({
        success: true,
        updatedDrivers,
        updatedSessions,
        updatedLocations,
      });
    }

    // Handle existing driver and car updates
    await prisma.$transaction(async (tx) => {
      if (type === "driver") {
        // Check if name is already taken
        const existingDriver = await tx.driver.findFirst({
          where: {
            name: newName,
            id: { not: id },
          },
        });

        if (existingDriver) {
          throw new Error("A driver with this name already exists");
        }

        // Update driver name
        await tx.driver.update({
          where: { id },
          data: { name: newName },
        });

        // Update driverName in all related sessions
        await tx.session.updateMany({
          where: { driverId: id },
          data: { driverName: newName },
        });
      } else if (type === "car") {
        // Get the car first to get its driver ID
        const car = await tx.car.findUnique({
          where: { id },
          select: { driverId: true },
        });

        if (!car) {
          throw new Error("Car not found");
        }

        // Check if name is already taken for this driver
        const existingCar = await tx.car.findFirst({
          where: {
            name: newName,
            driverId: car.driverId,
            id: { not: id },
          },
        });

        if (existingCar) {
          throw new Error("This driver already has a car with this name");
        }

        // Update car name
        await tx.car.update({
          where: { id },
          data: { name: newName },
        });

        // Update carName in all related sessions
        await tx.session.updateMany({
          where: { carId: id },
          data: { carName: newName },
        });
      }
    });

    // Fetch updated data
    const [updatedDrivers, updatedSessions] = await Promise.all([
      prisma.driver.findMany({
        include: {
          cars: true,
          sessions: {
            include: {
              laps: true,
              penalties: true,
            },
          },
        },
      }),
      prisma.session.findMany({
        include: {
          laps: true,
          penalties: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      updatedDrivers,
      updatedSessions,
    });
  } catch (error) {
    logger.error("Error updating:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { type, driverId, carId, id } = await request.json();

    if (type === "motionSetting") {
      await prisma.motionSettings.delete({
        where: { id },
      });
      return NextResponse.json({ success: true });
    }

    if (type === "location") {
      await prisma.$transaction(async (tx) => {
        // Find all sessions for this location
        const sessions = await tx.session.findMany({
          where: { locationId: id },
          select: { id: true },
        });

        // Delete all penalties and laps for these sessions
        if (sessions.length > 0) {
          const sessionIds = sessions.map((s) => s.id);

          await tx.penalty.deleteMany({
            where: { sessionId: { in: sessionIds } },
          });

          await tx.lap.deleteMany({
            where: { sessionId: { in: sessionIds } },
          });
        }

        // Delete session requests for this location
        await tx.sessionRequest.deleteMany({
          where: { locationId: id },
        });

        // Delete all sessions for this location
        await tx.session.deleteMany({
          where: { locationId: id },
        });

        // Finally delete the location
        await tx.location.delete({
          where: { id },
        });
      });

      const [updatedDrivers, updatedLocations] = await Promise.all([
        prisma.driver.findMany({
          include: { cars: true },
        }),
        prisma.location.findMany(),
      ]);

      return NextResponse.json({
        success: true,
        updatedDrivers,
        updatedLocations,
      });
    }

    if (type === "driver") {
      await prisma.$transaction(async (tx) => {
        // Find all cars for this driver
        const cars = await tx.car.findMany({
          where: { driverId },
          select: { id: true },
        });

        const carIds = cars.map((c) => c.id);

        // Find all sessions for these cars
        const sessions = await tx.session.findMany({
          where: { carId: { in: carIds } },
          select: { id: true },
        });

        const sessionIds = sessions.map((s) => s.id);

        // Delete all penalties and laps for these sessions
        if (sessionIds.length > 0) {
          await tx.penalty.deleteMany({
            where: { sessionId: { in: sessionIds } },
          });

          await tx.lap.deleteMany({
            where: { sessionId: { in: sessionIds } },
          });
        }

        // Delete session requests for this driver and their cars
        await tx.sessionRequest.deleteMany({
          where: {
            OR: [{ driverId }, { carId: { in: carIds } }],
          },
        });

        // Delete all sessions for the cars
        await tx.session.deleteMany({
          where: { carId: { in: carIds } },
        });

        // Delete all cars
        await tx.car.deleteMany({
          where: { driverId },
        });

        // Finally delete the driver
        await tx.driver.delete({
          where: { id: driverId },
        });
      });
    } else if (type === "car") {
      await prisma.$transaction(async (tx) => {
        // Find all sessions for this car
        const sessions = await tx.session.findMany({
          where: { carId },
          select: { id: true },
        });

        // Delete all penalties and laps for these sessions
        if (sessions.length > 0) {
          const sessionIds = sessions.map((s) => s.id);

          await tx.penalty.deleteMany({
            where: { sessionId: { in: sessionIds } },
          });

          await tx.lap.deleteMany({
            where: { sessionId: { in: sessionIds } },
          });
        }

        // Delete session requests for this car
        await tx.sessionRequest.deleteMany({
          where: { carId },
        });

        // Delete all sessions for this car
        await tx.session.deleteMany({
          where: { carId },
        });

        // Finally delete the car
        await tx.car.delete({
          where: { id: carId },
        });
      });
    }

    // Fetch updated drivers list
    const updatedDrivers = await prisma.driver.findMany({
      include: {
        cars: true,
      },
    });

    return NextResponse.json({
      success: true,
      updatedDrivers,
    });
  } catch (error) {
    logger.error("Error deleting:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete",
      },
      { status: 500 }
    );
  }
}
