import { doc, setDoc } from 'firebase/firestore';
import { db } from './src/lib/firebase';

async function resetAdminPassword() {
  try {
    const adminRef = doc(db, 'users', 'admin');
    await setDoc(adminRef, {
      uid: 'admin',
      username: 'admin',
      role: 'admin', // Ensure role is set
      email: 'reliancedialysiscenter.mabini@gmail.com',
      password: 'admin123',
      needsPasswordChange: true,
      isOnline: false,
      activeSessionId: null,
      createdAt: new Date().toISOString()
    });
    console.log('Admin password reset to default and needsPasswordChange set to true');
  } catch (error) {
    console.error('Error resetting admin password:', error);
  }
}

resetAdminPassword();