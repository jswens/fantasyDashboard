// Types for commissioner role management (admin-only). New file, not
// re-exported from src/lib/types/index.ts — same convention as cap.ts.

/** Document shape at commissioners/{uid}. */
export interface CommissionerEntry {
  uid: string;
  email: string;
  addedBy: string;
  addedAt: unknown; // Firestore server timestamp
}

export interface CommissionersListResponse {
  success: boolean;
  message: string;
  data?: CommissionerEntry[];
}

export interface CommissionerMutationResponse {
  success: boolean;
  message: string;
}
