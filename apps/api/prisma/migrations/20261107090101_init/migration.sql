-- CreateEnum
CREATE TYPE "Category" AS ENUM ('leftovers', 'fruit_veg', 'bread', 'packaged', 'dairy', 'other');

-- CreateEnum
CREATE TYPE "Origin" AS ENUM ('homemade', 'packaged', 'fresh_produce');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('available', 'reserved', 'collected', 'expired', 'removed');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('pending', 'confirmed', 'collected', 'cancelled', 'lapsed');

-- CreateEnum
CREATE TYPE "FridgeState" AS ENUM ('stocked', 'empty', 'needs_cleaning');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homeLat" DOUBLE PRECISION NOT NULL,
    "homeLng" DOUBLE PRECISION NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "Category" NOT NULL,
    "origin" "Origin" NOT NULL,
    "allergens" TEXT[],
    "bestBefore" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "publicLat" DOUBLE PRECISION NOT NULL,
    "publicLng" DOUBLE PRECISION NOT NULL,
    "handoverSpot" TEXT,
    "pickupFrom" TIMESTAMP(3) NOT NULL,
    "pickupUntil" TIMESTAMP(3) NOT NULL,
    "portions" INTEGER NOT NULL DEFAULT 1,
    "status" "ListingStatus" NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'pending',
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fridge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "openingHours" TEXT NOT NULL,
    "photoUrl" TEXT,

    CONSTRAINT "Fridge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FridgeCheckIn" (
    "id" TEXT NOT NULL,
    "fridgeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "FridgeState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FridgeCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusM" INTEGER NOT NULL DEFAULT 2000,
    "categories" "Category"[],

    CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "text" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Listing_status_lat_lng_idx" ON "Listing"("status", "lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_claimId_fromUserId_key" ON "Rating"("claimId", "fromUserId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FridgeCheckIn" ADD CONSTRAINT "FridgeCheckIn_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
