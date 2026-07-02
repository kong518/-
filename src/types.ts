export type RecordType = 'user' | 'assistant';

export interface ActivityRecord {
  id: string;
  yearMonth: string; // YYYY-MM
  name: string;
  dob: string; // YYMMDD
  type: RecordType;
  uploadedAt: any; // Firestore Timestamp
  isRecontract?: boolean;
  partnerName?: string;
  partnerDob?: string;
}

export interface MonthlyStats {
  yearMonth: string;
  total: number;
  newCount: number;
  terminatedCount: number;
  newList: ActivityRecord[];
  terminatedList: (ActivityRecord & { status: 'terminated' | 'waiting' })[];
}
