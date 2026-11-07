-- CreateEnum
CREATE TYPE "FridgeKind" AS ENUM ('fridge', 'pantry', 'dropoff');

-- CreateEnum
CREATE TYPE "FridgeStatus" AS ENUM ('pending', 'active', 'inactive', 'rejected');

-- CreateEnum
CREATE TYPE "FillLevel" AS ENUM ('empty', 'low', 'half', 'full');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('food_bank', 'ngo', 'charity', 'community_center', 'religious_org', 'other');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('admin', 'manager', 'volunteer', 'viewer');

-- CreateEnum
CREATE TYPE "BulkClaimStatus" AS ENUM ('pending', 'in_progress', 'partially_completed', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "bulkClaimId" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Fridge" ADD COLUMN     "accessNotes" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "kind" "FridgeKind" NOT NULL DEFAULT 'fridge',
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "FridgeStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "FridgeCheckIn" ADD COLUMN     "contents" TEXT,
ADD COLUMN     "fillLevel" "FillLevel";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "fridgeId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "mission" TEXT,
    "serviceArea" TEXT,
    "contactName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "logoUrl" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'pending',
    "createdById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateTable
CREATE TABLE "BulkClaim" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "scheduledPickupDate" TIMESTAMP(3) NOT NULL,
    "status" "BulkClaimStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkClaimItem" (
    "id" TEXT NOT NULL,
    "bulkClaimId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "isCollected" BOOLEAN NOT NULL DEFAULT false,
    "collectedAt" TIMESTAMP(3),

    CONSTRAINT "BulkClaimItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BulkClaimItem_claimId_key" ON "BulkClaimItem"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "BulkClaimItem_bulkClaimId_listingId_key" ON "BulkClaimItem"("bulkClaimId", "listingId");

-- CreateIndex
CREATE INDEX "Fridge_status_idx" ON "Fridge"("status");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDocument" ADD CONSTRAINT "OrganizationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkClaim" ADD CONSTRAINT "BulkClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkClaimItem" ADD CONSTRAINT "BulkClaimItem_bulkClaimId_fkey" FOREIGN KEY ("bulkClaimId") REFERENCES "BulkClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkClaimItem" ADD CONSTRAINT "BulkClaimItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
