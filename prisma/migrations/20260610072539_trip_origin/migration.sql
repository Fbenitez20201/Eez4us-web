-- CreateEnum
CREATE TYPE "TripOrigin" AS ENUM ('EN_CAMINO', 'ESTOY_AFUERA', 'WALKUP');

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "origin" "TripOrigin" NOT NULL DEFAULT 'EN_CAMINO';
