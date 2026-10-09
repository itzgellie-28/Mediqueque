import 'leaflet/dist/leaflet.css';
import React, { useState, useEffect } from "react";
import { auth, db } from "./lib/firebase";
import { 
  onAuthStateChanged, 
  signOut, 
  setPersistence, 
  browserLocalPersistence
} from "firebase/auth"; 
import { doc, onSnapshot } from "firebase/firestore";
import Auth from "./components/Auth";
import AdminPortal from "./components/AdminPortal";
import PasswordChange from "./components/PasswordChange";
import ProfileSetup from "./components/ProfileSetup";
import PatientPortal from "./components/PatientPortal";
import { UserProfile, UserRole } from "./types";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
    localStorage.removeItem('adminSession');
    localStorage.removeItem('adminData');
    setUser(null);
  };

  useEffect(() => {
    // Force persistent session (no logout on refresh)
    setPersistence(auth, browserLocalPersistence).catch(console.warn);

    let unsubProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        unsubProfile = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as any;
            setUser({
              uid: firebaseUser.uid,
              ...userData,
              email: userData.email || firebaseUser.email || '',
            });
          } else {
            signOut(auth);
            setUser(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("Firestore error:", err);
          setLoading(false);
        });
      } else {
        if (unsubProfile) unsubProfile();
        const adminSession = localStorage.getItem('adminSession');
        if (adminSession === 'true') {
          const adminData = localStorage.getItem('adminData');
          const parsedAdmin = adminData ? JSON.parse(adminData) : null;
          
          if (parsedAdmin) {
            // ✅ Extra listener to monitor if admin session is still valid globally
            unsubProfile = onSnapshot(doc(db, "users", "admin"), (docSnap) => {
              const dbData = docSnap.data();
              if (!dbData?.isOnline || dbData.activeSessionId !== parsedAdmin.activeSessionId) {
                handleLogout(); // Kick out if session changed or was cleared
              }
            });
            setUser(parsedAdmin);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 font-serif italic text-black">
        MediQueue: Synchronizing Secure Session...
      </div>
    );
  }

  if (!user) {
    return <Auth onLoginSuccess={(u) => setUser(u)} />;
  }

  // ✅ Use enum for admin check
  if (user.role === UserRole.ADMIN || user.role === 'admin') {
    return <AdminPortal user={user} onLogout={handleLogout} />;
  }

  // ✅ Skip profile setup if profileCompleted is true OR if fullName already exists
  if (user.role === UserRole.PATIENT && !user.profileCompleted && !user.fullName) {
    return <ProfileSetup user={user} onComplete={(u) => setUser(u)} />;
  }

  return <PatientPortal user={user} onLogout={handleLogout} />;
}