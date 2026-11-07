-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "EarlyAccessRole" AS ENUM ('giver', 'receiver', 'business', 'fridge_host', 'organization');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user',
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- CreateTable
CREATE TABLE "EarlyAccessSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "EarlyAccessRole" NOT NULL,
    "postcode" TEXT,
    "source" TEXT,
    "language" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarlyAccessSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EarlyAccessSignup_email_key" ON "EarlyAccessSignup"("email");

-- CreateIndex
CREATE INDEX "EarlyAccessSignup_role_idx" ON "EarlyAccessSignup"("role");

-- CreateIndex
CREATE INDEX "EarlyAccessSignup_source_idx" ON "EarlyAccessSignup"("source");
