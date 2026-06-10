export interface RankedTrip {
  tripId: string;
  parentId: string;
  parentName: string | null;
  vehicle: { plate: string; model: string; color: string } | null; // null = walk-up (sin vehículo)
  isWalkup: boolean;
  // EN_CAMINO = GPS+ETA · ESTOY_AFUERA = padre en puerta sin GPS · WALKUP = creado en portón
  origin: 'EN_CAMINO' | 'ESTOY_AFUERA' | 'WALKUP';
  students: Array<{ id: string; firstName: string; lastName: string }>;
  status: string;
  etaSeconds: number | null;
  etaUpdatedAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  arrivedAt: string | null;
}

export interface TripUpdatePayload {
  tripId: string;
  status: string;
  etaSeconds: number | null;
  etaUpdatedAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  arrivedAt: string | null;
}

export type RosterProximity = 'EN_CAMINO' | 'CERCA' | 'EN_PUERTA';

export interface RosterEntry {
  tripId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    grade: { id: string; name: string } | null;
  };
  pickupBy: {
    // 'walkup' = recogida en puerta sin viaje del padre (§A7-ter): la identidad del que
    // recoge no la conoce el sistema; la valida visualmente la miss.
    kind: 'parent' | 'authorized-family' | 'temporary-auth' | 'walkup';
    name: string;
    relationship?: string | null;
  };
  vehicle: { plate: string; model: string; color: string } | null;
  etaSeconds: number | null;
  proximity: RosterProximity;
  atGate: boolean;
}
