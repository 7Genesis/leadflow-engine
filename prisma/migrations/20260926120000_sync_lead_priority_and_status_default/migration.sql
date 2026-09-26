-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "priority" INTEGER DEFAULT 1,
ALTER COLUMN "status" SET DEFAULT 'New';
