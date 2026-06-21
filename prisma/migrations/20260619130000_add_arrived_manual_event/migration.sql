-- Distingue la llegada confirmada manualmente por el padre del trigger de geofence.
ALTER TYPE "TripEventType" ADD VALUE IF NOT EXISTS 'ARRIVED_MANUAL';
