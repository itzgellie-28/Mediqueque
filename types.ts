// ==================== ENUMS ====================
export enum UserRole {
  ADMIN = 'admin',
  PATIENT = 'patient'
}

export enum AppointmentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  CONFIRMED = 'confirmed'
}

export enum RequestStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

// ==================== USER PROFILE ====================
export interface UserProfile {
  uid: string;
  id?: string;
  username: string;
  email: string;
  role: UserRole | string;
  password?: string;
  createdAt?: string | any;
  needsPasswordChange?: boolean;
  fullName?: string;
  age?: string;
  birthday?: string;
  height?: string;
  weight?: string;
  medicalHistory?: string;
  profileCompleted?: boolean;
  isOnline?: boolean; // Added for admin session tracking
  activeSessionId?: string | null; // Added for admin session tracking
}

// ==================== APPOINTMENT ====================
export interface Appointment {
  id?: string;
  patientId: string;
  patientUsername?: string;
  patientName?: string;
  date: string;
  time: string;
  reason?: string;
  status: AppointmentStatus | string;
  createdAt?: any;
  notified?: boolean;
  type?: string;
  declineReason?: string;
}

// ==================== DOCUMENT REQUEST ====================
export interface DocumentRequest {
  id?: string;
  patientId: string;
  patientUsername?: string;
  type?: string;
  documentType?: string;
  status: RequestStatus | string;
  createdAt: any;
  processedAt?: any;
  fileUrl?: string;
  requestDate?: string;
}

// ==================== MESSAGE ====================
export interface Message {
  id?: string;
  senderId: string;
  receiverId?: string;
  text: string;
  timestamp: any;
  participants?: string[];
}

// ==================== FILE RECORD ====================
export interface FileRecord {
  id?: string;
  patientId: string;
  patientName?: string;
  name?: string;
  fileName?: string;
  fileData?: string;
  fileType?: string;
  url?: string;
  uploadedAt?: any;     // ✅ Definitely present
  createdAt?: any;
  requestId?: string;
}

// ==================== CHAT ROOM ====================
export interface ChatRoom {
  id: string;
  patientName: string;
  patientId: string;
  lastMessage: string;
  lastUpdate: any;
  unread: boolean;       // ✅ Added
  lastSenderId: string;  // ✅ Added
}