import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  try {
    const { type, id, newName } = await request.json();

    let updatedDrivers;
    let updatedSessions;

    // Use a transaction to ensure all updates are atomic
    await prisma.$transaction(async (tx) => {
      if (type === "driver") {
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

    // Fetch updated data including all related records
    updatedDrivers = await prisma.driver.findMany({
      include: {
        cars: true,
      },
    });

    // Fetch all updated sessions with necessary includes
    updatedSessions = await prisma.session.findMany({
      include: {
        laps: true,
        penalties: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    // Transform sessions to match expected format
    const formattedSessions = updatedSessions.map((session) => ({
      ...session,
      date: session.date.toISOString(), // Convert Date to string
    }));

    return NextResponse.json({
      success: true,
      updatedDrivers,
      updatedSessions: formattedSessions,
    });
  } catch (error) {
    console.error("Error updating:", error);
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
    const { type, driverId, carId } = await request.json();

    if (type === "driver") {
      // Delete driver and all related data
      await prisma.$transaction(async (tx) => {
        // First, delete all sessions and related data for all cars
        const cars = await tx.car.findMany({
          where: { driverId },
          select: { id: true },
        });

        for (const car of cars) {
          const sessions = await tx.session.findMany({
            where: { carId: car.id },
            select: { id: true },
          });

          for (const session of sessions) {
            await tx.penalty.deleteMany({
              where: { sessionId: session.id },
            });
            await tx.lap.deleteMany({
              where: { sessionId: session.id },
            });
          }

          await tx.session.deleteMany({
            where: { carId: car.id },
          });
        }

        // Then delete all cars
        await tx.car.deleteMany({
          where: { driverId },
        });

        // Finally delete the driver
        await tx.driver.delete({
          where: { id: driverId },
        });
      });
    } else if (type === "car") {
      // Delete car and all related data
      await prisma.$transaction(async (tx) => {
        // First, delete all sessions and related data
        const sessions = await tx.session.findMany({
          where: { carId },
          select: { id: true },
        });

        for (const session of sessions) {
          await tx.penalty.deleteMany({
            where: { sessionId: session.id },
          });
          await tx.lap.deleteMany({
            where: { sessionId: session.id },
          });
        }

        await tx.session.deleteMany({
          where: { carId },
        });

        // Then delete the car
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
    console.error("Error deleting:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
