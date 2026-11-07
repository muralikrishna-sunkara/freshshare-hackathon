/*
  Warnings:

  - You are about to drop the column `text` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `body` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- The old table was never written by the app (only cleared by the seed); start it fresh.
DELETE FROM "Notification";

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('claim_received', 'claim_confirmed', 'claim_cancelled', 'new_message', 'listing_expiring_soon', 'new_listing_nearby', 'waitlist_offer', 'fridge_approved', 'org_approved');

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "text",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "claimId" TEXT,
ADD COLUMN     "emailedAt" TIMESTAMP(3),
ADD COLUMN     "link" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" "NotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
