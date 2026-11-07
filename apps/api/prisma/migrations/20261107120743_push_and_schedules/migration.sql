-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "scheduleId" TEXT;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "Category" NOT NULL,
    "origin" "Origin" NOT NULL,
    "allergens" TEXT[],
    "dietaryTags" TEXT[],
    "portions" INTEGER NOT NULL DEFAULT 1,
    "weightKg" DOUBLE PRECISION,
    "handoverSpot" TEXT,
    "photos" TEXT[],
    "daysOfWeek" INTEGER[],
    "time" TEXT NOT NULL,
    "pickupHours" INTEGER NOT NULL DEFAULT 3,
    "bestBeforeDays" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastPostedOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "ListingSchedule_active_idx" ON "ListingSchedule"("active");
