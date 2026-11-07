-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('unsafe_food', 'prohibited_item', 'spam', 'no_show', 'harassment', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved');

-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE 'declined';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "areaName" TEXT,
ADD COLUMN     "dietaryTags" TEXT[],
ADD COLUMN     "photos" TEXT[],
ADD COLUMN     "postcode" TEXT,
ADD COLUMN     "weightKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "note" TEXT,
ADD COLUMN     "reportedUserId" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedBy" TEXT,
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'open',
ALTER COLUMN "listingId" DROP NOT NULL,
ALTER COLUMN "reason" TYPE "ReportReason" USING (
  CASE WHEN "reason" IN ('unsafe_food', 'prohibited_item', 'spam', 'no_show', 'harassment', 'other')
       THEN "reason"::"ReportReason" ELSE 'other'::"ReportReason" END
);

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");
