export type OperatorStatus = 'active' | 'suspended' | 'expired' | 'pending';

export interface Vehicle {
  id: string;
  plate: string;
  category: string;
  makeModel: string;
  color: string;
  registrationStatus: string;
}

export interface Operator {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  status: OperatorStatus;
  association: string;
  vehicle: Vehicle;
  lastVerified: string;
  credentialValidity: string;
}

export const mockOperators: Operator[] = [
  {
    id: 'op-123',
    code: 'BODA-782',
    firstName: 'John',
    lastName: 'Kato',
    photoUrl: 'https://picsum.photos/seed/john/200/200',
    status: 'active',
    association: 'Kampala Central Boda Association',
    vehicle: {
      id: 'veh-1',
      plate: 'UAB 123C',
      category: 'Motorcycle',
      makeModel: 'Bajaj Boxer',
      color: 'Red',
      registrationStatus: 'Verified',
    },
    lastVerified: '2026-03-13T08:30:00Z',
    credentialValidity: '2027-01-01T00:00:00Z',
  },
  {
    id: 'op-456',
    code: 'TAXI-901',
    firstName: 'Sarah',
    lastName: 'Nalubega',
    photoUrl: 'https://picsum.photos/seed/sarah/200/200',
    status: 'suspended',
    association: 'Entebbe Stage Taxis',
    vehicle: {
      id: 'veh-2',
      plate: 'UBA 456D',
      category: 'Minibus',
      makeModel: 'Toyota Hiace',
      color: 'White',
      registrationStatus: 'Pending Renewal',
    },
    lastVerified: '2026-02-15T14:20:00Z',
    credentialValidity: '2026-06-30T00:00:00Z',
  },
  {
    id: 'op-789',
    code: 'BODA-444',
    firstName: 'David',
    lastName: 'Okelo',
    photoUrl: 'https://picsum.photos/seed/david/200/200',
    status: 'expired',
    association: 'Gulu Riders Union',
    vehicle: {
      id: 'veh-3',
      plate: 'UCC 789E',
      category: 'Motorcycle',
      makeModel: 'TVS Star',
      color: 'Blue',
      registrationStatus: 'Expired',
    },
    lastVerified: '2025-11-10T09:15:00Z',
    credentialValidity: '2025-12-31T00:00:00Z',
  },
];

export interface IncidentReport {
  id: string;
  operatorCode: string;
  type: string;
  location: string;
  date: string;
  note: string;
  status: 'open' | 'investigating' | 'resolved';
  severity: 'low' | 'medium' | 'high';
}

export const mockIncidents: IncidentReport[] = [
  {
    id: 'inc-1',
    operatorCode: 'TAXI-901',
    type: 'Reckless Driving',
    location: 'Kampala Road',
    date: '2026-03-12T16:45:00Z',
    note: 'Driver was speeding and ignored traffic lights.',
    status: 'investigating',
    severity: 'high',
  },
  {
    id: 'inc-2',
    operatorCode: 'BODA-444',
    type: 'Overcharging',
    location: 'Ntinda',
    date: '2026-03-10T08:20:00Z',
    note: 'Charged double the agreed amount.',
    status: 'open',
    severity: 'medium',
  },
];
