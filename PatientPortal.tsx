import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, FileText, MessageSquare, LayoutDashboard,
  LogOut, Clock, CheckCircle2, PlusCircle, Download, Send,
  X, Menu, ClipboardList, ChevronLeft, MapPin, Trash2, User
} from 'lucide-react';
import { UserProfile, Appointment, DocumentRequest, Message, UserRole, FileRecord, ChatRoom } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

import { db, auth } from '../lib/firebase';
import {
  collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc,
  serverTimestamp, query, orderBy, where, setDoc
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import ClinicMapLeaflet from './ClinicMapLeaflet';

interface PatientProps {
  user: UserProfile;
  onLogout: () => void;
}

export default function PatientPortal({ user, onLogout }: PatientProps) {
  const [activeTab, setActiveTab] = useState('home');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [myFiles, setMyFiles] = useState<FileRecord[]>([]);
  const [myRequests, setMyRequests] = useState<DocumentRequest[]>([]);
  const [hasNewMsg, setHasNewMsg] = useState(false);

  const lastMsgRef = useRef<string | null>(null);

  useEffect(() => {
    // Request browser notification permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user.uid) return;

    const qApps = query(collection(db, "appointments"), where("patientId", "==", user.uid));
    const unsubApps = onSnapshot(qApps, (snapshot) => {
      const apps = snapshot.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as Appointment));
      const sorted = apps.sort((a, b) => {
        const timeA = a.createdAt?.seconds || Date.now() / 1000;
        const timeB = b.createdAt?.seconds || Date.now() / 1000;
        return timeB - timeA;
      });
      setMyAppointments(sorted);
    });

    const qFiles = query(collection(db, "files"), where("patientId", "==", user.uid));
    const unsubFiles = onSnapshot(qFiles, (snapshot) => {
      const files = snapshot.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as FileRecord));
      const sorted = files.sort((a, b) => {
        const timeA = a.uploadedAt?.seconds || Date.now() / 1000;
        const timeB = b.uploadedAt?.seconds || Date.now() / 1000;
        return timeB - timeA;
      });
      setMyFiles(sorted);
    });

    const qReqs = query(collection(db, "requests"), where("patientId", "==", user.uid));
    const unsubReqs = onSnapshot(qReqs, (snapshot) => {
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as DocumentRequest));
      const sorted = reqs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || Date.now() / 1000;
        const timeB = b.createdAt?.seconds || Date.now() / 1000;
        return timeB - timeA;
      });
      setMyRequests(sorted);
    });

    const chatRef = doc(db, "chats", user.uid);
    const unsubChat = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<ChatRoom>;
        const isNewUnread = data.unread === true && data.lastSenderId !== user.uid;
        setHasNewMsg(isNewUnread);

        // Trigger Push Notification logic
        if (isNewUnread && data.lastMessage && data.lastMessage !== lastMsgRef.current) {
          if (Notification.permission === "granted" && document.hidden) {
            const notification = new Notification("MediQueue Clinic", {
              body: `New message: ${data.lastMessage}`,
              icon: 'https://cdn-icons-png.flaticon.com/512/6073/6073873.png'
            });

            notification.onclick = () => {
              window.focus();
              setActiveTab('chat');
            };
          }
          lastMsgRef.current = data.lastMessage;
        }
      } else {
        setHasNewMsg(false);
      }
    });

    return () => {
      unsubApps();
      unsubFiles();
      unsubReqs();
      unsubChat();
    };
  }, [user.uid]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem('adminSession');
    localStorage.removeItem('adminData');
    onLogout();
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return <PatientHome user={user} appointments={myAppointments} hasNewMsg={hasNewMsg} setActiveTab={setActiveTab} />;
      case 'appointments':
        return <PatientAppointments user={user} appointments={myAppointments} />;
      case 'documents':
        return <PatientDocuments user={user} files={myFiles} requests={myRequests} />;
      case 'chat':
        return <PatientChat user={user} />;
      case 'location':
        return <PatientLocation />;
      case 'profile':
        return <ProfileView user={user} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#fcfcfc] text-black font-sans overflow-hidden w-full relative">
      {!isSidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-6 left-6 z-[110] p-4 bg-black text-white rounded-2xl shadow-2xl active:scale-95 transition-all hover:pr-8 group flex items-center gap-3"
        >
          <Menu size={20} />
          <span className="hidden group-hover:block text-[10px] font-bold uppercase tracking-widest">Menu</span>
        </button>
      )}

      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? (window.innerWidth < 1024 ? '85%' : 300) : 0,
          x: isSidebarOpen ? 0 : -300
        }}
        className="fixed inset-y-0 left-0 z-[120] bg-white border-r border-gray-100 flex flex-col p-8 lg:relative lg:z-50"
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-8 right-6 p-2 bg-gray-50 rounded-full hover:bg-black hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="font-serif italic text-2xl flex items-center gap-3 mb-12 whitespace-nowrap">
          <div className="bg-black text-white p-2 rounded-xl font-bold text-base shadow-lg">M</div>
          <span className="tracking-tighter font-bold">MediQueue</span>
        </div>

        <div className="mb-10 flex items-center gap-4 p-4 bg-gray-50 rounded-3xl cursor-pointer hover:bg-black hover:text-white transition-all group shadow-sm" onClick={() => setActiveTab('profile')}>
           <div className="h-12 w-12 bg-white text-black rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white">
             <User size={24} />
           </div>
           <div className="overflow-hidden">
             <p className="text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-60">Profile</p>
             <p className="font-serif italic text-lg leading-tight truncate">
               {user.fullName?.split(' ')[0] || user.username}
             </p>
           </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto scrollbar-hide pt-4">
          <PatientNavItem active={activeTab === 'home'} onClick={() => { setActiveTab('home'); if (window.innerWidth < 1024) setSidebarOpen(false); }} icon={<LayoutDashboard size={18} />} label="Overview" />
          <PatientNavItem active={activeTab === 'appointments'} onClick={() => { setActiveTab('appointments'); if (window.innerWidth < 1024) setSidebarOpen(false); }} icon={<Calendar size={18} />} label="Bookings" />
          <PatientNavItem active={activeTab === 'documents'} onClick={() => { setActiveTab('documents'); if (window.innerWidth < 1024) setSidebarOpen(false); }} icon={<FileText size={18} />} label="Documents" />
          <PatientNavItem active={activeTab === 'chat'} onClick={() => { setActiveTab('chat'); if (window.innerWidth < 1024) setSidebarOpen(false); }} icon={<MessageSquare size={18} />} label="Messages" hasNotif={hasNewMsg} />
          <PatientNavItem active={activeTab === 'location'} onClick={() => { setActiveTab('location'); if (window.innerWidth < 1024) setSidebarOpen(false); }} icon={<MapPin size={18} />} label="Location" />
        </nav>

        <button onClick={handleLogout} className="flex items-center gap-4 p-5 text-red-500 hover:bg-red-50 rounded-[1.5rem] font-bold text-[10px] uppercase tracking-widest mt-auto transition-all whitespace-nowrap">
          <LogOut size={18} /> Sign Out
        </button>
      </motion.aside>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[115] lg:hidden"
          />
        )}
      </AnimatePresence>

      <main className={`flex-1 overflow-y-auto w-full h-full p-6 lg:p-12 transition-all duration-500 ${!isSidebarOpen ? 'lg:pl-20' : ''}`}>
        <div className="w-full py-12 lg:py-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
            >
              {renderTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ------------------------------------------------------------
// Profile View
// ------------------------------------------------------------
function ProfileView({ user }: { user: UserProfile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName || '');
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [age, setAge] = useState(user.age || '');
  const [height, setHeight] = useState(user.height || '');
  const [weight, setWeight] = useState(user.weight || '');
  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [medicalHistory, setMedicalHistory] = useState(user.medicalHistory || '');
  const [loading, setLoading] = useState(false);

  const calculateAge = (bday: string): string => {
    if (!bday) return '';
    const today = new Date();
    const birthDate = new Date(bday);
    let calcAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calcAge--;
    }
    return calcAge >= 0 ? calcAge.toString() : '0';
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { 
        fullName, 
        birthday, 
        age, 
        height, 
        weight 
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update profile stats.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHistory = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { medicalHistory });
      setIsEditingHistory(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update medical history.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-end">
        <div>
        <p className="text-[10px] font-bold uppercase opacity-30 tracking-[0.3em] mb-2">My Profile</p>
        <h2 className="text-4xl lg:text-6xl font-serif italic">Personal Information</h2>
        </div>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="bg-black text-white px-8 py-4 rounded-full text-[10px] font-bold uppercase shadow-xl hover:scale-105 transition-all"
          >
            Edit Stats
          </button>
        )}
      </header>
      
      <div className="bg-white p-10 lg:p-14 rounded-[3rem] border border-gray-100 shadow-sm space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase opacity-30 tracking-widest">Full Name</p>
            {isEditing ? (
              <input type="text" className="w-full p-4 bg-gray-50 rounded-2xl border outline-none focus:border-black text-sm" value={fullName} onChange={e => setFullName(e.target.value)} />
            ) : (
              <p className="text-2xl font-serif italic">{user.fullName || 'Not set'}</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase opacity-30 tracking-widest">Birthday & Age</p>
            {isEditing ? (
              <div className="flex gap-4">
                <input 
                  type="date" 
                  className="flex-1 p-4 bg-gray-50 rounded-2xl border outline-none focus:border-black text-sm" 
                  value={birthday} 
                  onChange={e => {
                    const val = e.target.value;
                    setBirthday(val);
                    setAge(calculateAge(val));
                  }} 
                />
                <div className="w-20 p-4 bg-gray-100 rounded-2xl text-center text-sm font-bold opacity-50">{age || '--'}</div>
              </div>
            ) : (
              <p className="text-2xl font-serif italic">{user.birthday || '---'} ({user.age || '0'} y/o)</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase opacity-30 tracking-widest">Height & Weight</p>
            {isEditing ? (
              <div className="flex gap-4">
                <input 
                  type="text" 
                  placeholder="Height (e.g. 170cm)" 
                  className="w-full p-4 bg-gray-50 rounded-2xl border outline-none focus:border-black text-sm" 
                  value={height} 
                  onChange={e => setHeight(e.target.value)} 
                />
                <input 
                  type="text" 
                  placeholder="Weight (e.g. 65kg)" 
                  className="w-full p-4 bg-gray-50 rounded-2xl border outline-none focus:border-black text-sm" 
                  value={weight} 
                  onChange={e => setWeight(e.target.value)} 
                />
              </div>
            ) : (
              <p className="text-2xl font-serif italic">{user.height || 'N/A'} / {user.weight || 'N/A'}</p>
            )}
          </div>
        </div>
        
        {isEditing && (
          <div className="flex gap-4 pt-4">
            <button 
              disabled={loading}
              onClick={handleSave}
              className="bg-black text-white px-10 py-4 rounded-full text-[10px] font-bold uppercase shadow-xl disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button 
              onClick={() => { 
                setIsEditing(false); 
                setFullName(user.fullName || '');
                setBirthday(user.birthday || '');
                setAge(user.age || '');
                setHeight(user.height || ''); 
                setWeight(user.weight || ''); 
              }} 
              className="px-10 py-4 border border-gray-100 rounded-full text-[10px] font-bold uppercase"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="pt-10 border-t border-gray-50">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[10px] font-black uppercase opacity-30 tracking-widest">Medical History (Dating Sakit)</p>
            {!isEditingHistory && (
              <button 
                onClick={() => setIsEditingHistory(true)}
                className="text-[10px] font-bold uppercase text-black hover:underline"
              >
                Edit
              </button>
            )}
          </div>
          <div className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100">
            {isEditingHistory ? (
              <textarea
                className="w-full bg-transparent outline-none font-serif italic text-lg leading-relaxed h-32 scrollbar-hide"
                value={medicalHistory}
                onChange={e => setMedicalHistory(e.target.value)}
                placeholder="List any conditions (Diabetes, Hypertension, etc.)"
              />
            ) : (
              <p className="text-lg font-serif italic opacity-60 leading-relaxed">
                {user.medicalHistory || 'No medical history recorded.'}
              </p>
            )}
          </div>
          {isEditingHistory && (
            <div className="flex gap-4 mt-4 px-4">
              <button 
                disabled={loading}
                onClick={handleSaveHistory}
                className="bg-black text-white px-8 py-3 rounded-full text-[10px] font-bold uppercase shadow-lg disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save History'}
              </button>
              <button 
                onClick={() => { setIsEditingHistory(false); setMedicalHistory(user.medicalHistory || ''); }} 
                className="px-8 py-3 border border-gray-100 rounded-full text-[10px] font-bold uppercase"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Navigation Item
// ------------------------------------------------------------
function PatientNavItem({ active, onClick, icon, label, hasNotif }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-4 rounded-[1.2rem] transition-all ${active ? 'bg-black text-white shadow-xl translate-x-2' : 'text-gray-400 hover:bg-gray-50'}`}>
      <div className="flex items-center gap-4">
        {icon} <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      {hasNotif && <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></span>}
    </button>
  );
}

// ------------------------------------------------------------
// Patient Home
// ------------------------------------------------------------
function PatientHome({ user, appointments, hasNewMsg, setActiveTab }: any) {
  const activeApp = appointments.find((a: any) => a.status === 'approved');

  return (
    <div className="space-y-10">
      <header>
        <p className="text-[10px] font-bold uppercase opacity-30 tracking-[0.3em] mb-2">Patient Dashboard</p>
        <h1 className="text-4xl lg:text-6xl font-serif italic capitalize">Hello, {user.username}.</h1>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-black text-white p-10 lg:p-14 rounded-[3rem] lg:rounded-[4rem] relative overflow-hidden group min-h-[300px] flex flex-col justify-between">
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase opacity-50 mb-8 tracking-widest">Active Schedule</p>
            {activeApp ? (
              <div className="space-y-2">
                <h2 className="text-5xl lg:text-7xl font-serif italic tracking-tighter">{activeApp.date}</h2>
                <p className="text-xl opacity-60 italic">{activeApp.time}</p>
              </div>
            ) : <p className="text-xl italic opacity-30">No upcoming appointments.</p>}
          </div>
          <button onClick={() => setActiveTab('appointments')} className="relative z-10 bg-white text-black px-10 py-5 rounded-full text-[10px] font-bold uppercase w-fit shadow-2xl hover:scale-105 transition-all">Request a slot</button>
          <Calendar className="absolute -right-20 -bottom-20 opacity-10 group-hover:scale-110 transition-transform duration-[2s]" size={400} />
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 flex flex-col justify-between hover:border-black transition-all cursor-pointer shadow-sm group" onClick={() => setActiveTab('documents')}>
          <div>
            <ClipboardList className="mb-8 opacity-20 group-hover:opacity-100 group-hover:text-black transition-all" size={48} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Documents</h3>
            <p className="text-sm italic opacity-40 mt-2">Download your MedCert & results</p>
          </div>
          <PlusCircle className="self-end opacity-20 group-hover:opacity-100" size={24} />
        </div>
      </div>

      <div className="bg-white p-8 lg:p-10 rounded-[2.5rem] border-2 border-gray-100 flex flex-col md:flex-row items-center gap-8 shadow-sm opacity-50">
        <div className="bg-gray-50 p-6 rounded-[2rem] text-black shadow-inner relative z-10 flex-shrink-0">
          <Clock size={32} />
        </div>
        <div className="flex-1 relative z-10 text-center md:text-left">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mb-2">Clinical Information</h4>
          <p className="text-xl lg:text-2xl font-serif italic opacity-70 leading-relaxed">"Monitor your scheduled visits and medical documents from this dashboard."</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Patient Appointments
// ------------------------------------------------------------
function PatientAppointments({ user, appointments }: any) {
  const [isBooking, setIsBooking] = useState(false);
  const [newApp, setNewApp] = useState({ date: '', time: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [slotOccupancy, setSlotOccupancy] = useState<Record<string, number>>({});

  const TIME_SLOTS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
  ];
  const SLOT_CAPACITY = 3; // Realistic limit: 3 patients per 30 mins

  useEffect(() => {
    if (!newApp.date || !isBooking) return;
    
    // Global query to check all appointments for the selected date
    const q = query(collection(db, "appointments"), where("date", "==", newApp.date));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'pending' || data.status === 'approved') {
          counts[data.time] = (counts[data.time] || 0) + 1;
        }
      });
      setSlotOccupancy(counts);
    });

    return () => unsubscribe();
  }, [newApp.date, isBooking]);

  const handleCancel = async (id: string | undefined) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to cancel this pending appointment?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
    } catch (err) {
      console.error("Error deleting appointment:", err);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const selectedDateTime = new Date(`${newApp.date}T${newApp.time}`);
    const now = new Date();

    // 1. Validation: No past dates/time
    if (selectedDateTime < now) {
      alert("❌ You cannot book an appointment in the past. Please select a future date and time.");
      return;
    }

    // 2. Validation: Monday to Friday only (Block Saturdays and Sundays)
    const [y, m, d] = newApp.date.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      alert("❌ The clinic is only open from Monday to Friday. Please select a weekday.");
      return;
    }

    // 3. Concurrency Check: Verify if slot filled up while user was typing
    if ((slotOccupancy[newApp.time] || 0) >= SLOT_CAPACITY) {
      alert("❌ Pasensya na, kapupuno lang ng slot na ito. Pumili ng ibang oras.");
      return;
    }

    // 4. Prevent Duplicates: Check if patient has a pending or approved appt on the same day/time
    const isDuplicate = appointments.some((a: any) => 
      a.date === newApp.date && 
      a.time === newApp.time && 
      (a.status === 'pending' || a.status === 'approved')
    );

    if (isDuplicate) {
      alert("⚠️ You already have an active appointment request for this date and time.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "appointments"), {
        patientId: user.uid,
        patientUsername: user.username,
        date: newApp.date,
        time: newApp.time,
        reason: newApp.reason,
        status: 'pending',
        notified: false,
        createdAt: serverTimestamp()
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsBooking(false);
        // Small delay before resetting state to allow exit animation
        setTimeout(() => {
          setIsSuccess(false);
          setNewApp({ date: '', time: '', reason: '' });
        }, 500);
      }, 2500);
    } catch (err) {
      console.error(err);
      alert("Error booking appointment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end border-b border-gray-50 pb-10">
        <h2 className="text-4xl font-serif italic tracking-tight">Bookings</h2>
        <button onClick={() => setIsBooking(true)} className="bg-black text-white px-10 py-5 rounded-full text-[10px] font-bold uppercase shadow-2xl active:scale-95 transition-all">New Appointment</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {appointments.map((a: any) => (
          <div key={a.id} className="bg-white p-10 rounded-[3rem] border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex justify-between items-start mb-8">
              <p className="font-serif italic text-3xl">{a.date}</p>
              <span className={`px-4 py-2 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                a.status === 'approved' ? 'bg-green-50 text-green-600' : 
                a.status === 'cancelled' ? 'bg-red-50 text-red-600' : 
                'bg-yellow-50 text-yellow-600'
              }`}>{a.status}</span>
            </div>
            <div className="flex items-center gap-3 opacity-30 text-[10px] font-bold uppercase"><Clock size={14} /> {a.time}</div>
            
            {a.reason && (
              <div className="mt-6">
                <p className="text-[9px] font-bold uppercase opacity-30 mb-1">Your Concern:</p>
                <p className="text-sm italic font-serif opacity-50 border-l-2 border-gray-100 pl-3">{a.reason}</p>
              </div>
            )}
            
            {a.status === 'pending' && (
              <button 
                onClick={() => handleCancel(a.id)}
                className="mt-6 text-[9px] font-bold uppercase text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
              >
                <Trash2 size={12} /> Cancel Request
              </button>
            )}
            
            {a.status === 'cancelled' && a.declineReason && (
              <div className="mt-6 pt-4 border-t border-red-50">
                <p className="text-[9px] font-bold uppercase text-red-400 mb-1">Reason for Decline:</p>
                <p className="text-sm italic font-serif text-red-600/70">{a.declineReason}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isBooking && (
          <div className="fixed inset-0 z-[200] bg-white">
            <motion.form 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              onSubmit={handleBook} 
              className="bg-white w-full h-full relative flex flex-col overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {!isSuccess ? (
                  <motion.div 
                    key="form-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col h-full w-full overflow-hidden"
                  >
                    {/* Header - Fixed */}
                    <div className="p-4 lg:p-6 flex justify-between items-center border-b border-gray-50">
                      <div>
                        <h3 className="text-2xl lg:text-3xl font-serif italic tracking-tighter">Visit Form</h3>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-30 mt-1">Book your clinical appointment</p>
                      </div>
                      <button type="button" onClick={() => setIsBooking(false)} className="p-4 bg-gray-50 hover:bg-black hover:text-white rounded-2xl transition-all active:scale-90"><X size={24} /></button>
                    </div>

                    {/* Main Content Area - Split Layout */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6">
                        
                        {/* Left Side: Inputs */}
                        <div className="lg:col-span-4 space-y-6">
                          <div className="space-y-4">
                            <label className="text-xs font-black uppercase opacity-40 tracking-[0.2em] px-2">01. Choose Date</label>
                            <input 
                              type="date" 
                              required 
                              disabled={loading} 
                              min={new Date().toISOString().split('T')[0]}
                              className="w-full p-6 bg-gray-50 rounded-[2rem] outline-none focus:bg-white border-2 border-transparent focus:border-black transition-all text-lg font-bold shadow-inner"
                              onChange={e => {
                                const val = e.target.value;
                                if (!val) return;
                                const [y, m, d] = val.split('-').map(Number);
                                const day = new Date(y, m - 1, d).getDay();
                                if (day === 0 || day === 6) {
                                  alert("❌ Clinic closed on weekends.");
                                  e.target.value = "";
                                  setNewApp({ ...newApp, date: "" });
                                  return;
                                }
                                setNewApp({ ...newApp, date: val });
                              }} 
                            />
                          </div>

                          <div className="space-y-4">
                            <label className="text-xs font-black uppercase opacity-40 tracking-[0.2em] px-2">03. Additional Notes</label>
                            <textarea 
                              required 
                              disabled={loading} 
                              placeholder="Reason for visit..." 
                              className="w-full p-5 bg-gray-50 rounded-[2rem] h-32 outline-none focus:bg-white border-2 border-transparent focus:border-black transition-all text-sm font-serif italic shadow-inner"
                              onChange={e => setNewApp({ ...newApp, reason: e.target.value })} 
                            />
                          </div>
                        </div>

                        {/* Right Side: Slots Grid */}
                        <div className="lg:col-span-8 space-y-2">
                          <div className="flex justify-between items-center px-2">
                            <label className="text-xs font-black uppercase opacity-40 tracking-[0.2em]">02. Select Available Slot</label>
                            <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest opacity-40">
                              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Available</span>
                              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Full</span>
                            </div>
                          </div>

                          {!newApp.date ? (
                            <div className="h-full min-h-[400px] border-4 border-dashed border-gray-50 rounded-[3rem] flex items-center justify-center text-center p-12">
                              <p className="font-serif italic text-2xl opacity-20">Please select a date first to view the clinical schedule.</p>
                            </div>
                          ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-3">
                              {TIME_SLOTS.map(slot => {
                                const count = slotOccupancy[slot] || 0;
                                const isFull = count >= SLOT_CAPACITY;
                                const isSelected = newApp.time === slot;
                                const isPast = (() => {
                                  const today = new Date().toISOString().split('T')[0];
                                  if (newApp.date !== today) return false;
                                  const [h, m] = slot.split(':').map(Number);
                                  const now = new Date();
                                  const slotTime = new Date();
                                  slotTime.setHours(h, m, 0, 0);
                                  return slotTime < now;
                                })();

                                return (
                                  <motion.button
                                    key={slot}
                                    type="button"
                                    disabled={isFull || isPast || loading}
                                    whileHover={!(isFull || isPast || loading) ? { scale: 1.02, y: -4 } : {}}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setNewApp({ ...newApp, time: slot })}
                              className={`p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-1
                                      ${isSelected ? 'bg-black text-white border-black shadow-2xl scale-105 z-10' : 
                                        (isFull || isPast) ? 'bg-gray-50 text-gray-300 border-gray-50 cursor-not-allowed opacity-50' : 
                                        'bg-white text-black border-gray-100 hover:border-black shadow-sm'}
                                    `}
                                  >
                              <span className="text-xl font-black">{slot}</span>
                              <span className={`text-[8px] font-black tracking-[0.05em] ${isFull ? 'text-red-500' : isPast ? 'text-gray-300' : isSelected ? 'text-white/60' : 'text-green-600'}`}>
                                      {isFull ? 'UNAVAILABLE' : isPast ? 'PAST' : `${SLOT_CAPACITY - count} SLOTS LEFT`}
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer - Sticky */}
                    <div className="p-4 lg:p-5 bg-white border-t border-gray-50 flex justify-center items-center">
                      <button type="submit" disabled={loading || !newApp.time || !newApp.date} className="w-full max-w-xl py-5 bg-black text-white rounded-full font-bold uppercase text-[10px] tracking-[0.4em] shadow-2xl disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.95]">
                        {loading ? "Requesting..." : "Confirm Slot"}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="success-view"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center p-12 lg:p-20 text-center space-y-6 flex-1"
                  >
                    <div className="h-24 w-24 bg-green-50 text-green-500 rounded-[2.5rem] flex items-center justify-center">
                      <CheckCircle2 size={48} className="animate-bounce" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-3xl font-serif italic tracking-tight">Request Sent!</h3>
                      <p className="text-sm opacity-50 italic">Your slot for {newApp.date} at {newApp.time} is now pending approval.</p>
                    </div>
                    <div className="pt-4">
                      <div className="h-1 w-12 bg-green-100 rounded-full mx-auto"></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------
// Patient Documents
// ------------------------------------------------------------
function PatientDocuments({ user, files, requests }: { user: UserProfile; files: FileRecord[]; requests: DocumentRequest[] }) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [type, setType] = useState('');

  const handleCancelRequest = async (id: string | undefined) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to cancel this request?")) return;
    try {
      await deleteDoc(doc(db, "requests", id));
    } catch (err) {
      console.error("Error deleting request:", err);
    }
  };

  const handleDownload = (fileDataOrUrl: string, fileName: string) => {
    try {
      if (fileDataOrUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = fileDataOrUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        fetch(fileDataOrUrl)
          .then(res => res.blob())
          .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          })
          .catch(() => window.open(fileDataOrUrl, '_blank'));
      }
    } catch (err) {
      console.error("Download failed", err);
      alert("Unable to download file. Please try again.");
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end border-b pb-10">
        <h2 className="text-4xl font-serif italic">Vault</h2>
        <button onClick={() => setIsRequesting(true)} className="bg-black text-white px-10 py-5 rounded-full text-[10px] font-bold uppercase shadow-xl">Request File</button>
      </div>

      {/* Request Tracking Section */}
      {requests.filter(r => r.status !== 'completed').length > 0 && (
        <div className="space-y-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 px-4">Request Tracking</h3>
          <div className="grid grid-cols-1 gap-4">
            {requests.filter(r => r.status !== 'completed').map((r) => (
              <div key={r.id} className="bg-white p-6 rounded-[2.5rem] border border-dashed border-gray-200 flex justify-between items-center group hover:border-black transition-all">
                <div className="flex items-center gap-6">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${r.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
                    <Clock size={20} className={r.status === 'pending' ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <p className="font-serif italic text-xl">{r.type}</p>
                    <p className="text-[9px] font-bold uppercase opacity-30 mt-1">Requested on {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : 'Recently'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-4 py-2 rounded-full text-[8px] font-bold uppercase tracking-widest ${r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.status === 'pending' ? 'Reviewing Request' : r.status}
                  </span>
                  {r.status === 'pending' && (
                    <button 
                      onClick={() => handleCancelRequest(r.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Cancel Request"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 px-4 mt-12">Dispatched Documents</h3>
      <div className="grid grid-cols-1 gap-6">
        {files.length > 0 ? files.map((f: FileRecord) => {
          const fileSource = f.fileData || f.url || '';
          const fileType = f.fileType || '';
          const isImage = fileType.startsWith('image/');
          const isPdf = fileType === 'application/pdf';

          if (!fileSource) return null;

          return (
            <div key={f.id} className="bg-white p-6 lg:p-10 rounded-[3rem] border border-gray-100 hover:border-black transition-all shadow-sm">
              <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <FileText size={28} />
                  </div>
                  <div>
                    <p className="font-serif italic text-2xl truncate max-w-[200px] md:max-w-md">{f.name || f.fileName || 'Document'}</p>
                    <p className="text-[9px] font-bold uppercase opacity-30 mt-1">
                      Received: {f.uploadedAt?.toDate ? f.uploadedAt.toDate().toLocaleDateString() : 'Recently'}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleDownload(fileSource, f.name || f.fileName || 'document')} className="bg-blue-600 text-white px-6 py-3 rounded-full text-[10px] font-bold uppercase flex items-center gap-2 hover:scale-105 transition-all">
                  <Download size={16} /> Download
                </button>
              </div>
              {isImage && (
                <div className="mt-4 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                  <img src={fileSource} alt={f.name} className="w-full max-h-[400px] object-contain" />
                </div>
              )}
              {isPdf && (
                <div className="mt-4 rounded-2xl overflow-hidden border border-gray-100">
                  <iframe src={fileSource} className="w-full h-[500px]" title={f.name} />
                </div>
              )}
              {!isImage && !isPdf && (
                <div className="mt-6 p-8 bg-gray-50 rounded-2xl text-center border border-dashed">
                  <p className="text-[10px] font-bold uppercase opacity-40">Preview not available</p>
                  <p className="text-sm italic mt-2">Click Download to view this document</p>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="p-20 text-center italic opacity-20 text-2xl font-serif flex flex-col items-center gap-4">
            <ClipboardList size={64} />
            No documents dispatched yet.
          </div>
        )}
      </div>

      <AnimatePresence>
        {isRequesting && (
          <div className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-md p-4">
            <motion.form initial={{ y: 50 }} animate={{ y: 0 }} onSubmit={async (e) => {
              e.preventDefault();
              await addDoc(collection(db, "requests"), {
                patientId: user.uid,
                patientUsername: user.username,
                type: type,
                status: 'pending',
                createdAt: serverTimestamp()
              });
              setIsRequesting(false);
              setType('');
            }} className="bg-white p-12 rounded-t-[3.5rem] lg:rounded-[4rem] w-full max-w-md space-y-8 shadow-2xl">
              <h3 className="text-3xl font-serif italic text-center">Request Center</h3>
              <select required className="w-full p-6 bg-gray-50 rounded-3xl outline-none text-sm font-bold uppercase tracking-widest" value={type} onChange={e => setType(e.target.value)}>
                <option value="">Select File Type</option>
                <option value="Medical Certificate">Medical Certificate</option>
                <option value="Laboratory Results">Laboratory Results</option>
              </select>
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsRequesting(false)} className="flex-1 text-[10px] font-bold uppercase py-6">Cancel</button>
                <button type="submit" className="flex-1 py-6 bg-black text-white rounded-full text-[10px] font-bold uppercase shadow-2xl">Send</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------
// Patient Chat (fully functional - CORRECTED SYNTAX)
// ------------------------------------------------------------
function PatientChat({ user }: { user: UserProfile }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chatId = user.uid;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // ✅ Correct mapping: each doc is converted properly
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      })) as Message[];
      
      setMessages(msgs);
    });
    
    // Mark messages as read when chat is opened
    const chatDoc = doc(db, "chats", chatId);
    setDoc(chatDoc, { unread: false }, { merge: true }).catch(console.warn);
    
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msgText = text.trim();
    setText('');
    setIsSending(true);

    const chatId = user.uid;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const chatDoc = doc(db, "chats", chatId);
    
    try {
      await Promise.all([
        addDoc(messagesRef, {
          senderId: user.uid,
          text: msgText,
          timestamp: serverTimestamp()
        }),
        updateDoc(chatDoc, {
          lastMessage: msgText,
          lastUpdate: serverTimestamp(),
          unread: true,
          lastSenderId: user.uid,
          patientName: user.username
        })
      ]);
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-[500px] lg:h-[750px] flex flex-col bg-white rounded-[3rem] lg:rounded-[4rem] border border-gray-100 overflow-hidden shadow-2xl">
      <div className="p-6 lg:p-10 border-b flex justify-between items-center bg-white">
        <h2 className="font-serif italic text-3xl px-2 text-black">Clinic Inbox</h2>
        <div className="flex items-center gap-2"><div className="h-2 w-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_green]"></div><span className="text-[9px] font-bold uppercase opacity-40">{isSending ? 'Sending...' : 'Connected'}</span></div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 lg:p-14 space-y-6 lg:space-y-8 bg-[#fcfcfc] scrollbar-hide">
        {messages.map((m, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            key={i} 
            className={`flex ${m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div className="flex flex-col gap-1 max-w-[85%]">
              <div className={`p-4 lg:p-6 rounded-[2rem] text-sm shadow-sm ${m.senderId === user.uid ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-gray-100 text-black rounded-tl-none font-serif italic'}`}>{m.text}</div>
              <span className={`text-[7px] font-bold uppercase opacity-30 ${m.senderId === user.uid ? 'text-right mr-2' : 'ml-2'}`}>
                {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      <form onSubmit={onSend} className="p-4 lg:p-10 bg-white border-t flex gap-2 lg:gap-4">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message..." className="flex-1 p-4 lg:p-6 bg-gray-50 rounded-3xl outline-none focus:bg-white border focus:border-black transition-all text-sm" />
        <button disabled={isSending} className={`p-4 lg:p-6 bg-black text-white rounded-3xl shadow-xl active:scale-90 transition-all flex-shrink-0 ${isSending ? 'opacity-50' : ''}`}>
          <Send size={20} className="lg:w-6 lg:h-6" />
        </button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------
// Patient Location (with possible routes and Google Maps link)
// ------------------------------------------------------------
function PatientLocation() {
  const hospitalLocation: [number, number] = [13.7547, 120.9413]; // Reliance Dialysis Center Inc. - Mabini Branch

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=Reliance+Dialysis+Center+Inc.+-+Mabini+Branch+Sitio+Mailayin+Mabini+Batangas`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-10">
      <header>
        <p className="text-[10px] font-bold uppercase opacity-30 tracking-[0.3em] mb-2">Maps & Directions</p>
        <h2 className="text-4xl lg:text-6xl font-serif italic">Clinic Location</h2>
      </header>

      <div className="bg-white p-6 lg:p-10 rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-black text-white p-4 rounded-2xl">
            <MapPin size={24} />
          </div>
          <div>
            <p className="font-serif italic text-2xl">Reliance Dialysis Center Inc. - Mabini Branch</p>
            <p className="text-[10px] font-bold uppercase opacity-30">Sitio Mailayin, P. Niogan, Mabini, Batangas, Philippines</p>
          </div>
        </div>

        <div className="rounded-[2rem] overflow-hidden border border-gray-100 h-[450px] z-10 relative">
          <ClinicMapLeaflet center={hospitalLocation} hospitalName="Reliance Dialysis Center Inc. - Mabini Branch" />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={openInGoogleMaps}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
          >
            <span>📍</span> Open in Google Maps
          </button>
        </div>

        <div className="mt-12 space-y-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 px-4">Possible Driving / Transit Routes</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="group p-6 bg-gray-50 rounded-[2rem] border border-gray-100 hover:bg-black hover:text-white transition-all duration-500">
              <div className="flex items-start gap-4">
                <div className="bg-white text-black p-3 rounded-xl group-hover:bg-white/20 group-hover:text-white transition-colors">
                  <div className="font-bold text-sm">01</div>
                </div>
                <div>
                  <h4 className="font-bold text-sm uppercase tracking-wider mb-2">Via Bauan–Mabini Road</h4>
                  <p className="text-xs opacity-60 leading-relaxed group-hover:opacity-80">
                    Mula sa Bauan proper, sundin ang main highway patungong Mabini. Pagdating sa Mabini Triangle (near the plaza), kumanan patungong P. Niogan. Diretso lang hanggang Sitio Mailayin – nasa right side ang center.
                  </p>
                </div>
              </div>
            </div>

            <div className="group p-6 bg-gray-50 rounded-[2rem] border border-gray-100 hover:bg-black hover:text-white transition-all duration-500">
              <div className="flex items-start gap-4">
                <div className="bg-white text-black p-3 rounded-xl group-hover:bg-white/20 group-hover:text-white transition-colors">
                  <div className="font-bold text-sm">02</div>
                </div>
                <div>
                  <h4 className="font-bold text-sm uppercase tracking-wider mb-2">Via Anilao Road</h4>
                  <p className="text-xs opacity-60 leading-relaxed group-hover:opacity-80">
                    Mula sa Anilao Port, dumaan sa coastal road (Anilao–Mabini Road). Pagdating sa crossing bago ang Mabini Plaza, kumanan sa direksyon ng P. Niogan. Sundan ang road signs – ang center ay nasa Sitio Mailayin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 bg-blue-50/50 rounded-[2rem] border border-blue-100">
            <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-blue-800 italic">🕒 Hospital Hours</h4>
            <p className="text-sm italic text-blue-900/60">
              <strong>Out‑Patient Department (OPD):</strong> Mon – Fri (8:00 AM – 5:00 PM)<br />
              <strong>Emergency Room:</strong> 24 hours / 7 days a week
            </p>
          </div>
          <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 flex items-center justify-between">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-1">Need help?</h4>
              <p className="text-xs opacity-50 italic">Call for emergency assistance</p>
            </div>
            <button
              onClick={() => alert("For emergencies, call our hotline: (043) 123-4567")}
              className="bg-black text-white px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
            >
              Call Center
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}