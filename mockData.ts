import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where, orderBy, limit, addDoc, deleteDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  UserProfile, UserRole, Appointment, AppointmentStatus, 
  DocumentRequest, RequestStatus, Message, FileRecord 
} from '../types';

// Helper to convert Firestore Timestamp to JS Date safely
const toDate = (timestamp: any): Date => {
  if (timestamp?.toDate) return timestamp.toDate();
  return new Date(timestamp);
};

// ==================== USERS ====================
export const getUsers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
};

export const getUserById = async (id: string): Promise<UserProfile | null> => {
  const docSnap = await getDoc(doc(db, 'users', id));
  return docSnap.exists() ? ({ uid: docSnap.id, ...docSnap.data() } as UserProfile) : null;
};

export const createUser = async (user: Omit<UserProfile, 'uid'>): Promise<UserProfile> => {
  const uid = Math.random().toString(36).substring(2, 9);
  const newUser: UserProfile = { ...user, uid, createdAt: new Date().toISOString() };
  await setDoc(doc(db, 'users', uid), newUser);
  return newUser;
};

export const updateUser = async (id: string, data: Partial<UserProfile>): Promise<void> => {
  await updateDoc(doc(db, 'users', id), data);
};

// ==================== APPOINTMENTS ====================
export const getAppointments = async (patientId?: string): Promise<Appointment[]> => {
  const coll = collection(db, 'appointments');
  const q = patientId ? query(coll, where('patientId', '==', patientId)) : coll;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
};

export const addAppointment = async (appt: Omit<Appointment, 'id' | 'createdAt'>): Promise<Appointment> => {
  const newAppt: any = { ...appt, createdAt: new Date().toISOString() };
  const docRef = await addDoc(collection(db, 'appointments'), newAppt);
  return { id: docRef.id, ...newAppt };
};

export const updateAppointmentStatus = async (id: string, status: AppointmentStatus): Promise<void> => {
  await updateDoc(doc(db, 'appointments', id), { status });
};

// ==================== REQUESTS ====================
export const getRequests = async (patientId?: string): Promise<DocumentRequest[]> => {
  const coll = collection(db, 'requests');
  const q = patientId ? query(coll, where('patientId', '==', patientId)) : coll;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentRequest));
};

export const addRequest = async (req: Omit<DocumentRequest, 'id' | 'createdAt'>): Promise<DocumentRequest> => {
  const newReq: any = { ...req, createdAt: new Date().toISOString() };
  const docRef = await addDoc(collection(db, 'requests'), newReq);
  return { id: docRef.id, ...newReq };
};

export const updateRequestStatus = async (id: string, status: RequestStatus): Promise<void> => {
  await updateDoc(doc(db, 'requests', id), { status });
};

// ==================== FILES ====================
export const getFiles = async (patientId?: string): Promise<FileRecord[]> => {
  const coll = collection(db, 'files');
  const q = patientId ? query(coll, where('patientId', '==', patientId)) : coll;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FileRecord));
};

export const addFile = async (file: Omit<FileRecord, 'id' | 'createdAt'>): Promise<FileRecord> => {
  const newFile: any = { ...file, createdAt: new Date().toISOString() };
  const docRef = await addDoc(collection(db, 'files'), newFile);
  return { id: docRef.id, ...newFile };
};

// ==================== MESSAGES ====================
export const getMessages = async (userId: string): Promise<Message[]> => {
  try {
    // ✅ Fixed: query using 'participants' field (must exist in Message)
    const q = query(collection(db, 'messages'), where('participants', 'array-contains', userId));
    const snap = await getDocs(q);
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
    // ✅ Fixed: sort safely using toDate helper
    return msgs.sort((a, b) => toDate(a.timestamp).getTime() - toDate(b.timestamp).getTime());
  } catch (error: any) {
    if (error.message?.includes('index')) {
      console.error("Need to create composite index for messages. Follow the link.");
    }
    return [];
  }
};

export const sendMessage = async (message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> => {
  const newMsg: any = { 
    ...message, 
    timestamp: new Date().toISOString(),
    participants: [message.senderId, message.receiverId].filter(Boolean)
  };
  const docRef = await addDoc(collection(db, 'messages'), newMsg);
  return { id: docRef.id, ...newMsg };
};

// Get unread count (simplified)
export const getUnreadCount = async (userId: string, role: UserRole): Promise<number> => {
  try {
    const messages = await getMessages(userId);
    const lastReadKey = role === UserRole.ADMIN ? `last_read_admin_${userId}` : `last_read_patient_${userId}`;
    const metaRef = doc(db, 'user_meta', lastReadKey);
    const metaSnap = await getDoc(metaRef);
    const lastReadStr = metaSnap.exists() ? metaSnap.data().timestamp : '1970-01-01T00:00:00.000Z';
    const lastReadTime = new Date(lastReadStr).getTime();
    
    return messages.filter(m => {
      const msgTime = toDate(m.timestamp).getTime();
      return msgTime > lastReadTime && m.senderId !== userId;
    }).length;
  } catch (err) {
    return 0;
  }
};

export const markMessagesAsRead = async (userId: string, role: UserRole): Promise<void> => {
  const lastReadKey = role === UserRole.ADMIN ? `last_read_admin_${userId}` : `last_read_patient_${userId}`;
  await setDoc(doc(db, 'user_meta', lastReadKey), { timestamp: new Date().toISOString() });
};

// ==================== PASSWORD ====================
export const changePassword = async (uid: string, newPassword: string): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { 
    password: newPassword,
    needsPasswordChange: false 
  });
};

export const getCurrentUser = async (): Promise<UserProfile | null> => {
  // This would typically get the current authenticated user from Firebase Auth
  return null;
};

/**
 * Utility to manually trigger password change requirement for admin
 */
export const resetAdminToDefault = async (): Promise<void> => {
  await updateDoc(doc(db, 'users', 'admin'), { 
    password: 'admin123',
    username: 'admin', // Ensure username is also set
    email: 'reliancedialysiscenter.mabini@gmail.com',
    needsPasswordChange: true 
  });
};