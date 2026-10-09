import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Calendar, FileText, MessageSquare, LayoutDashboard,
  LogOut, X, Send, Clock, CheckCircle2, Upload, Eye, ArrowUpRight, RotateCw, Activity // Added Activity for loading state
} from 'lucide-react';
import { UserProfile, Appointment, DocumentRequest, Message, UserRole, ChatRoom } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import * as mammoth from 'mammoth';

import { db, auth } from '../lib/firebase';
import {
  collection, onSnapshot, doc, updateDoc, addDoc, setDoc,
  serverTimestamp, query, orderBy, where, getDoc
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';

interface AdminProps {
  user: UserProfile;
  onLogout: () => void;
}

export default function AdminPortal({ user, onLogout }: AdminProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const [hasNewApp, setHasNewApp] = useState(false);
  const [hasNewReq, setHasNewReq] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const lastAdminMsgRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as UserProfile));
      setUsers(userList);
    });

    const qApps = collection(db, "appointments");
    const unsubApps = onSnapshot(qApps, (s) => {
      const apps = s.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as Appointment));
      // Sort client-side to avoid index requirements
      const sorted = apps.sort((a, b) => {
        const timeA = a.createdAt?.seconds || (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() / 1000 : 0);
        const timeB = b.createdAt?.seconds || (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() / 1000 : 0);
        return timeB - timeA;
      });
      setAppointments(sorted);
      setHasNewApp(sorted.some(a => a.status === 'pending'));
    }, (err) => console.error("Apps listener error:", err));

    const qReqs = collection(db, "requests");
    const unsubReqs = onSnapshot(qReqs, (s) => {
      const reqs = s.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as DocumentRequest));
      // Sort client-side
      const sorted = reqs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() / 1000 : 0);
        const timeB = b.createdAt?.seconds || (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() / 1000 : 0);
        return timeB - timeA;
      });
      setRequests(sorted);
      setHasNewReq(sorted.some(r => r.status === 'pending'));
      setLoading(false);
    }, (err) => {
      console.error("Reqs listener error:", err);
      setLoading(false);
    });

    // Listen for unread messages in any chat room
    const unsubChatNotif = onSnapshot(collection(db, "chats"), (s) => {
      const chats = s.docs.map(d => ({ id: d.id, ...d.data() } as ChatRoom));
      const unreadChats = chats.filter(c => c.unread === true && c.lastSenderId !== user.uid);
      setHasNewMsg(unreadChats.length > 0);

      // Push Notifications for Admin
      unreadChats.forEach(chat => {
        if (chat.lastMessage && chat.lastMessage !== lastAdminMsgRef.current[chat.id]) {
          if (Notification.permission === "granted" && document.hidden) {
            const notification = new Notification(`Message from ${chat.patientName}`, {
              body: chat.lastMessage,
              icon: 'https://cdn-icons-png.flaticon.com/512/6073/6073873.png'
            });

            notification.onclick = () => {
              window.focus();
              setSelectedChatId(chat.id);
              setActiveTab('chat');
            };
          }
          lastAdminMsgRef.current[chat.id] = chat.lastMessage;
        }
      });
    });

    return () => { unsubUsers(); unsubApps(); unsubReqs(); unsubChatNotif(); };
  }, [user.uid, refreshKey]);

  const handleTerminateSession = async () => {
    try {
      await updateDoc(doc(db, "users", "admin"), { isOnline: false, activeSessionId: null });
      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();
      onLogout();
      window.location.replace('/');
    } catch (err) {
      console.error(err);
      alert("Logout failed. Please refresh.");
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': {
        const totalPatients = users.filter(u => u.role === 'patient' || u.role === UserRole.PATIENT).length;
        const pendingAppointments = appointments.filter(a => a.status === 'pending').length;
        const pendingRequests = requests.filter(r => r.status === 'pending').length;
        return (
          <AdminDashboard
            stats={{ users: totalPatients, apps: pendingAppointments, reqs: pendingRequests }}
            appointments={appointments}
            requests={requests}
            setActiveTab={setActiveTab}
          />
        );
      }
      case 'users': return <UserManagement users={users} />;
      case 'appointments': return <AppointmentManagement appointments={appointments} user={user} setActiveTab={setActiveTab} setSelectedChatId={setSelectedChatId} />;
      case 'requests': return <RequestManagement requests={requests} adminUser={user} />;
      case 'chat': return <AdminChat users={users} currentUser={user} initialChatId={selectedChatId} />;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-black font-sans overflow-hidden">
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 flex flex-col p-6 space-y-8 transition-all duration-300 shadow-sm z-50`}>
        <div className="font-serif italic text-xl flex items-center gap-3 px-2">
          <div className="bg-black text-white p-2 rounded-xl shadow-lg font-bold">M</div>
          {!isCollapsed && <span className="tracking-tight text-black font-bold">MediQueue</span>}
        </div>
        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={18}/>} label="Dashboard" collapsed={isCollapsed} />
          <NavItem active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={18}/>} label="Patients" collapsed={isCollapsed} />
          <NavItem active={activeTab === 'appointments'} onClick={() => { setSelectedChatId(null); setActiveTab('appointments'); }} icon={<Calendar size={18}/>} label="Appointments" collapsed={isCollapsed} hasNotif={hasNewApp} />
          <NavItem active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} icon={<FileText size={18}/>} label="Requests" collapsed={isCollapsed} hasNotif={hasNewReq} />
          <NavItem active={activeTab === 'chat'} onClick={() => { setSelectedChatId(null); setActiveTab('chat'); }} icon={<MessageSquare size={18}/>} label="Messages" collapsed={isCollapsed} hasNotif={hasNewMsg} />
        </nav>
        <button onClick={handleTerminateSession} className="flex items-center gap-4 p-4 text-red-600 hover:bg-red-50 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all">
          <LogOut size={18}/> {!isCollapsed && "Logout"}
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto p-4 md:p-12 relative bg-[#fcfcfc]">
        <div className="w-full">
          <div className="flex justify-end mb-8">
            <button 
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-sm active:scale-95 group"
            >
              <RotateCw 
                size={14} 
                className={`${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} 
              />
              {loading ? 'Syncing...' : 'Refresh Data'}
            </button>
          </div>

          {loading && !appointments.length && !requests.length ? (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
              <Clock className="animate-pulse text-black/20" size={48} />
              <p className="font-serif italic text-black/40 text-center">Synchronizing medical records...</p>
            </div>
          ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {renderTab()}
            </motion.div>
          </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, collapsed, hasNotif }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all relative ${active ? 'bg-black text-white shadow-lg' : 'text-black hover:bg-gray-100'}`}>
      <div className="flex items-center gap-4">
        <span>{icon}</span>
        {!collapsed && <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{label}</span>}
      </div>
      {hasNotif && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}
    </button>
  );
}

function AdminDashboard({ stats, appointments, requests, setActiveTab }: any) {
  const recentApps = appointments.filter((a: any) => a.status === 'pending').slice(0, 3);
  const recentReqs = requests.slice(0, 3);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard label="Total Patients" value={stats.users} />
        <StatCard label="Waitlist Queue" value={stats.apps} />
        <StatCard label="Open Requests" value={stats.reqs} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-8 text-[10px] font-bold uppercase tracking-widest opacity-40">
            <h3 className="tracking-[0.3em]">Waitlist Preview</h3>
            <button onClick={() => setActiveTab('appointments')} className="hover:underline flex items-center gap-1">Open <ArrowUpRight size={12}/></button>
          </div>
          <div className="space-y-4">
            {recentApps.length > 0 ? recentApps.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-5 bg-gray-50/50 rounded-[2rem] border border-gray-50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-black text-white rounded-xl flex items-center justify-center font-bold italic">{a.patientUsername?.charAt(0)}</div>
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-1">{a.date} | {a.time}</p>
                    <p className="font-serif italic text-lg leading-tight">{a.patientUsername}</p>
                    {a.reason && <p className="text-[10px] opacity-50 italic truncate max-w-[150px]">{a.reason}</p>}
                  </div>
                </div>
                <div className={`h-2 w-2 rounded-full ${
                  a.status === 'pending' ? 'bg-red-500 animate-pulse' : 
                  a.status === 'approved' ? 'bg-green-500' : 
                  'bg-gray-300'
                }`}></div>
              </div>
            )) : (
              <p className="text-sm italic opacity-30 px-4 py-10 text-center">No pending appointments to show.</p>
            )}
          </div>
        </div>
        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-8 text-[10px] font-bold uppercase tracking-widest opacity-40">
            <h3>System Activity Feed</h3>
            <button onClick={() => setActiveTab('requests')} className="hover:underline flex items-center gap-1">Logs <ArrowUpRight size={12}/></button>
          </div>
          <div className="space-y-6">
            {recentReqs.map((r: any) => (
              <div key={r.id} className="flex gap-4 items-start border-l-2 border-gray-100 pl-6 relative">
                <div className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${r.status === 'pending' ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                <div>
                  <p className="text-sm font-serif italic">{r.patientUsername} requested {r.type}</p>
                  <p className="text-[8px] font-bold uppercase opacity-30 mt-1">Status: {r.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: any) {
  return (
    <div className="p-10 rounded-[3rem] border bg-white shadow-sm">
      <p className="text-[10px] uppercase opacity-40 mb-4 tracking-widest font-bold">{label}</p>
      <p className="text-6xl font-serif italic">{value}</p>
    </div>
  );
}

function UserManagement({ users }: { users: UserProfile[] }) {
  const patients = users.filter(u => u.role === 'patient' || u.role === UserRole.PATIENT);
  return (
    <div className="bg-white rounded-[3rem] border overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-[10px] font-bold uppercase border-b">
          <tr><th className="px-10 py-6">Patient</th><th className="px-10 py-6">Role</th></tr>
        </thead>
        <tbody className="divide-y">
          {patients.map(u => (
            <tr key={u.uid}>
              <td className="px-10 py-8 font-serif italic text-2xl">{u.username}</td>
              <td className="px-10 py-8 text-[10px] font-bold uppercase opacity-30">{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------- APPOINTMENT MANAGEMENT (with auto‑message on approval) --------------------
function AppointmentManagement({ 
  appointments, 
  user, 
  setActiveTab, 
  setSelectedChatId 
}: { 
  appointments: Appointment[]; 
  user: UserProfile;
  setActiveTab: (tab: string) => void;
  setSelectedChatId: (id: string | null) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const TIME_SLOTS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
  ];
  const SLOT_CAPACITY = 3;

  const updateStatus = async (id: string | undefined, newStatus: string, patientId?: string, patientUsername?: string, reason?: string) => {
    if (!id) return;
    const updateData: any = { status: newStatus };
    if (reason) updateData.declineReason = reason;
    await updateDoc(doc(db, "appointments", id), updateData);

    // If approved, send a chat message to the patient with instructions
    if (newStatus === 'approved' && patientId) {
      await sendSystemMessage(patientId, patientUsername || "Patient", "✅ Your appointment has been approved. Please come on time. If you have questions, reply here.");
    } else if (newStatus === 'cancelled' && patientId && reason) {
      await sendSystemMessage(patientId, patientUsername || "Patient", `❌ Your appointment has been declined. Reason: ${reason}. Please book a new slot.`);
    } else if (newStatus === 'completed' && patientId) {
      await sendSystemMessage(patientId, patientUsername || "Patient", "✅ Your appointment has been marked as completed. Thank you for your visit!");
    }
  };

  const sendSystemMessage = async (patientId: string, patientName: string, text: string) => {
    try {
      const chatId = patientId;
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);

      const chatSummary = {
        patientId: patientId,
        patientName: patientName,
        lastMessage: text,
        lastUpdate: serverTimestamp(),
        unread: true,
        lastSenderId: user.uid
      };

      if (!chatSnap.exists()) {
        await setDoc(chatRef, chatSummary);
      } else {
        await updateDoc(chatRef, chatSummary);
      }

      // Add the message to messages subcollection
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: user.uid,
        text: text,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to send system message:", err);
    }
  };

  // Explicitly separate for manual management
  const allPending = appointments.filter(a => a.status === 'pending');
  const approved = appointments.filter(a => a.status === 'approved' && a.date === selectedDate);
  const history = appointments.filter(a => a.status === 'cancelled' || a.status === 'completed');

  const renderAppointment = (a: Appointment) => (
    <div key={a.id} className={`p-8 rounded-[2.5rem] border transition-all ${a.status === 'pending' ? 'bg-white border-black shadow-md' : 'bg-gray-50 border-gray-100'}`}>
          <p className="text-xs font-black opacity-30 uppercase tracking-[0.2em] mb-4">{a.date} | {a.time}</p>
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <h4 className="text-2xl font-serif italic">{a.patientUsername}</h4>
              <button 
                onClick={() => { setSelectedChatId(a.patientId); setActiveTab('chat'); }}
                className="p-3 bg-gray-100 hover:bg-black hover:text-white rounded-xl transition-all shadow-sm"
                title="Quick Chat"
              >
                <MessageSquare size={14} />
              </button>
            </div>
            <span className={`px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest ${
              a.status === 'approved' || a.status === 'completed' ? 'bg-green-100 text-green-700' : 
              a.status === 'pending' ? 'bg-red-100 text-red-700' : 
              'bg-gray-100 text-gray-600'
            }`}>
              {a.status}
            </span>
          </div>
          {a.reason && (
            <div className="mb-6">
              <p className="text-[9px] font-bold uppercase opacity-30 mb-1">Reason for Visit:</p>
              <p className="text-sm italic font-serif opacity-70 border-l-2 border-gray-100 pl-3">{a.reason}</p>
            </div>
          )}
          {a.declineReason && (
            <div className="mb-6">
              <p className="text-[9px] font-bold uppercase text-red-500 opacity-60 mb-1">Decline Reason:</p>
              <p className="text-sm italic font-serif text-red-600/70 border-l-2 border-red-100 pl-3">{a.declineReason}</p>
            </div>
          )}
          {a.status === 'pending' && (
            decliningId === a.id ? (
              <div className="space-y-4">
                <textarea 
                  placeholder="State the reason for declining..." 
                  className="w-full p-4 bg-gray-50 border rounded-2xl text-sm italic font-serif outline-none focus:border-black"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => { updateStatus(a.id, 'cancelled', a.patientId, a.patientUsername, declineReason); setDecliningId(null); setDeclineReason(''); }} 
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-bold uppercase"
                  >Confirm Decline</button>
                  <button onClick={() => { setDecliningId(null); setDeclineReason(''); }} className="flex-1 py-4 border rounded-2xl text-[10px] font-bold uppercase">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => updateStatus(a.id, 'approved', a.patientId, a.patientUsername)} className="flex-1 py-4 bg-black text-white rounded-2xl text-[10px] font-bold uppercase">Approve</button>
                <button onClick={() => setDecliningId(a.id || null)} className="flex-1 py-4 border-2 border-black rounded-2xl text-[10px] font-bold uppercase">Decline</button>
              </div>
            )
          )}
          {a.status === 'approved' && (
            <div className="flex gap-2">
              <button onClick={() => updateStatus(a.id, 'completed', a.patientId, a.patientUsername)} className="w-full py-4 bg-gray-50 hover:bg-black hover:text-white transition-all text-black rounded-2xl text-[10px] font-bold uppercase">Mark as Completed</button>
            </div>
          )}
        </div>
  );

  // Group appointments for the selected date by time
  const dayApps = appointments.filter(a => a.date === selectedDate && (a.status === 'pending' || a.status === 'approved'));
  const slotGroups = dailyGroup(dayApps);

  function dailyGroup(apps: Appointment[]) {
    const groups: Record<string, Appointment[]> = {};
    apps.forEach(a => {
      if (!groups[a.time]) groups[a.time] = [];
      groups[a.time].push(a);
    });
    // Sort each group by creation time so we see who was first
    Object.keys(groups).forEach(t => {
      groups[t].sort((a, b) => {
        const timeA = a.createdAt?.seconds || (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() / 1000 : 0);
        const timeB = b.createdAt?.seconds || (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() / 1000 : 0);
        return timeA - timeB;
      });
    });
    return groups;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      {/* Sidebar Filter */}
      <div className="w-full lg:w-80 space-y-8 lg:sticky lg:top-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-6 flex items-center gap-2">
            <Calendar size={14}/> Schedule Filter
          </h3>
          <div className="space-y-6">
            <div>
              <label className="text-[9px] font-bold uppercase opacity-30 mb-2 block px-2">Select Date</label>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-black outline-none font-bold text-xs transition-all"
              />
            </div>
            
            <div className="pt-6 border-t border-gray-50">
              <p className="text-[9px] font-bold uppercase opacity-30 mb-4 px-2">Daily Summary</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-gray-50 rounded-2xl text-center">
                  <span className="text-[10px] font-bold uppercase opacity-40 block mb-1">Waitlist</span>
                  <span className="text-xl font-serif italic">{allPending.length}</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl text-center">
                  <span className="text-[10px] font-bold uppercase opacity-40 block mb-1">Schedule</span>
                  <span className="text-xl font-serif italic">{approved.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main List Area */}
      <div className="flex-1 w-full space-y-12">
        <section className="space-y-8">
          <div className="px-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Clinical Queue List</p>
            <h2 className="text-3xl lg:text-4xl font-serif italic">
              {selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : selectedDate}
            </h2>
          </div>

          <div className="space-y-6">
            {approved.length > 0 ? (
              approved
                .sort((a, b) => a.time.localeCompare(b.time))
                .map(renderAppointment)
            ) : (
              <div className="py-20 text-center bg-white border border-dashed rounded-[3rem] opacity-30">
                <p className="font-serif italic text-2xl">No approved schedule for this date.</p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Check another date or refresh records</p>
              </div>
            )}
          </div>
        </section>

        {/* Global Waitlist Section */}
        <section className="space-y-8 pt-10 border-t border-gray-100">
          <div className="px-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Waitlist (Global)</p>
            <h2 className="text-3xl font-serif italic text-red-500/60">Pending Requests</h2>
          </div>
          <div className="space-y-6">
            {allPending.length > 0 ? (
              allPending
                .sort((a, b) => {
                  if (a.date !== b.date) return a.date.localeCompare(b.date);
                  return a.time.localeCompare(b.time);
                })
                .map(renderAppointment)
            ) : (
              <p className="opacity-30 italic px-4">No pending requests at the moment.</p>
            )}
          </div>
        </section>

        {history.length > 0 && (
          <div className="pt-10 border-t border-gray-100">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity mb-6"
            >
              {showHistory ? "Hide History" : `See Previous Appointments (${history.length})`}
            </button>
            
            {showHistory && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
                {history.map(renderAppointment)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------- REQUEST MANAGEMENT (unchanged but included) --------------------
function RequestManagement({ requests, adminUser }: { requests: DocumentRequest[]; adminUser: UserProfile }) {
  const [preview, setPreview] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, reqId: string | undefined) => {
    const file = e.target.files?.[0];
    if (!file || !reqId) {
      alert("No file selected or request ID missing.");
      return;
    }
    if (file.size > 800000) {
      alert("File too large! Max 800KB for free tier.");
      return;
    }
    let htmlContent = null;
    let objectUrl = null;
    if (file.name.toLowerCase().endsWith('.docx')) {
      try {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        htmlContent = result.value;
      } catch (err) {
        console.error("DOCX conversion error:", err);
        alert("Could not preview DOCX file. You can still send it.");
      }
    } else if (file.type.startsWith('image/')) {
      objectUrl = URL.createObjectURL(file);
    } else {
      objectUrl = URL.createObjectURL(file);
    }
    setPreview({
      file,
      name: file.name,
      reqId,
      html: htmlContent,
      url: objectUrl,
      type: file.type
    });
  };

  const handleCompleteAndDispatch = async () => {
    if (!preview || isSending) return;
    const target = requests.find(r => r.id === preview.reqId);
    if (!target?.patientId) {
      alert("❌ Error: Patient ID missing from this request.");
      return;
    }
    setIsSending(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(preview.file);
      const base64String = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      await addDoc(collection(db, "files"), {
        patientId: target.patientId,
        patientName: target.patientUsername || "Patient",
        name: preview.name,
        fileData: base64String,
        fileType: preview.type,
        uploadedAt: serverTimestamp(),
        requestId: preview.reqId
      });
      await updateDoc(doc(db, "requests", preview.reqId!), {
        status: 'completed',
        processedAt: serverTimestamp()
      });

      // ✅ Automatic Notification Message
      const msgText = `✅ Your requested document "${preview.name}" is now available. Please check your Documents tab to download it. If you have questions, reply here.`;
      const chatId = target.patientId;
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);

      const chatSummary = {
        patientId: target.patientId,
        patientName: target.patientUsername || "Patient",
        lastMessage: msgText,
        lastUpdate: serverTimestamp(),
        unread: true,
        lastSenderId: adminUser.uid
      };

      if (!chatSnap.exists()) {
        await setDoc(chatRef, chatSummary);
      } else {
        await updateDoc(chatRef, chatSummary);
      }

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: adminUser.uid,
        text: msgText,
        timestamp: serverTimestamp()
      });

      alert(`✅ Successfully sent "${preview.name}" to patient's Vault.`);
      setPreview(null);
    } catch (err: any) {
      console.error(err);
      alert("❌ Upload failed: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const completedRequests = requests.filter(r => r.status === 'completed');

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <section className="space-y-4">
        <h2 className="font-serif italic text-3xl">Pending Requests</h2>
        {pendingRequests.map(r => (
          <div key={r.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-red-50 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-6">
              <div className="h-14 w-14 bg-red-500 text-white rounded-2xl flex items-center justify-center animate-pulse"><FileText size={24} /></div>
              <div>
                <p className="font-serif italic text-2xl">{r.type}</p>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">From: {r.patientUsername}</p>
              </div>
            </div>
            <label className="cursor-pointer bg-black text-white px-10 py-5 rounded-full text-[10px] font-bold uppercase shadow-xl flex items-center gap-3 hover:scale-105 transition-all">
              <Upload size={18}/> Dispatch
              <input type="file" className="hidden" onChange={(e) => onFileSelect(e, r.id)} />
            </label>
          </div>
        ))}
        {pendingRequests.length === 0 && <p className="opacity-30 italic px-4">No pending requests. All clear!</p>}
      </section>

      {completedRequests.length > 0 && (
        <section className="space-y-4 border-t pt-10">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity mb-4"
          >
            {showHistory ? "Hide Dispatched" : "See Dispatched History"}
          </button>
          
          {showHistory && (
            <div className="space-y-4 opacity-60">
              <h2 className="font-serif italic text-xl mb-6">Recently Dispatched</h2>
              {completedRequests.map(r => (
                <div key={r.id} className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex justify-between items-center">
                  <p className="font-serif italic text-lg">{r.type} <span className="not-italic text-[10px] opacity-40">— {r.patientUsername}</span></p>
                  <CheckCircle2 className="text-green-600" size={24}/>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <AnimatePresence>
        {preview && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white w-full max-w-4xl h-[85vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b flex justify-between items-center font-bold text-[10px] uppercase tracking-widest">
                <span>Preview: {preview.name}</span>
                <button onClick={() => setPreview(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-auto p-8 bg-gray-50">
                {preview.html ? <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: preview.html }} /> : preview.type?.startsWith('image/') ? <img src={preview.url} className="mx-auto rounded-xl shadow-lg max-h-full object-contain" alt="preview" /> : <div className="flex flex-col items-center justify-center h-full gap-6"><FileText size={64} className="opacity-20" /><p className="text-sm italic opacity-50">Preview not available.</p><a href={preview.url} download={preview.name} className="bg-black text-white px-8 py-4 rounded-full text-[10px] font-bold uppercase">Download</a></div>}
              </div>
              <div className="p-6 border-t flex justify-end gap-4 bg-white">
                <button onClick={() => setPreview(null)} className="px-8 py-4 border rounded-full text-[10px] font-bold uppercase hover:bg-gray-50">Cancel</button>
                <button onClick={handleCompleteAndDispatch} disabled={isSending} className="px-8 py-4 bg-black text-white rounded-full text-[10px] font-bold uppercase disabled:opacity-50">{isSending ? "Sending..." : "Confirm & Send"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------- ADMIN CHAT (fully fixed - listens to all chats) --------------------
function AdminChat({ users, currentUser, initialChatId }: any) {
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [chatList, setChatList] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedInitialId = useRef<string | null>(null);

  // Listen to all chat rooms (each patient has a document in 'chats' with id = patient uid)
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "chats"), orderBy("lastUpdate", "desc")), (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) }));
      setChatList(rooms);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Only auto-select if initialChatId is provided AND it's different from what we last processed
    if (initialChatId && chatList.length > 0 && processedInitialId.current !== initialChatId) {
      const room = chatList.find(r => r.id === initialChatId);
      if (room) {
        setSelected(room);
        processedInitialId.current = initialChatId;
      }
    }
  }, [initialChatId, chatList]);

  // Listen to messages of selected chat
  useEffect(() => {
    if (!selected) return;
    const messagesRef = collection(db, "chats", selected.id, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      })) as Message[];
      setMessages(msgs);
    });
    // Mark chat as read when admin opens it
    const chatRef = doc(db, "chats", selected.id);
    setDoc(chatRef, { unread: false }, { merge: true });
    return () => unsub();
  }, [selected]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const onSend = async (e: any) => {
    e.preventDefault();
    if (!text.trim() || !selected) return;
    const msgText = text.trim();
    setText('');
    setIsSending(true);

    const messagesRef = collection(db, "chats", selected.id, "messages");
    const chatRef = doc(db, "chats", selected.id);
    
    try {
      await Promise.all([
        addDoc(messagesRef, {
          senderId: currentUser.uid,
          text: msgText,
          timestamp: serverTimestamp()
        }),
        setDoc(chatRef, {
          lastMessage: msgText,
          lastUpdate: serverTimestamp(),
          unread: true,
          lastSenderId: currentUser.uid
        }, { merge: true })
      ]);
    } catch (err) {
      console.error("Admin send failed:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[600px] bg-white rounded-[3.5rem] border shadow-sm overflow-hidden">
      <div className="w-full lg:w-96 h-48 lg:h-full border-b lg:border-b-0 lg:border-r bg-gray-50/30 p-4 lg:p-6 overflow-y-auto scrollbar-hide flex flex-col">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 mb-6 px-4 shrink-0">Clinic Inbox</p>
        <div className="flex-1 space-y-3">
          {chatList.map(room => {
            const isUnread = room.unread && room.lastSenderId !== currentUser.uid;
            const isSelected = selected?.id === room.id;

            return (
              <motion.button 
                whileHover={{ x: 4, scale: 1.01 }}
                key={room.id} 
                onClick={() => setSelected(room)} 
                className={`w-full p-6 rounded-[2rem] text-left transition-all border 
                  ${isSelected ? 'bg-black text-white border-black shadow-xl z-10' : 
                    isUnread ? 'bg-white border-black shadow-lg ring-1 ring-black/5' : 'bg-white border-gray-100 hover:border-black opacity-80 hover:opacity-100'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <p className={`font-serif italic text-lg leading-none ${isUnread && !isSelected ? 'font-black' : ''}`}>{room.patientName}</p>
                  <span className={`text-[8px] font-bold ${isSelected ? 'text-white/40' : isUnread ? 'text-red-500' : 'opacity-30'}`}>
                    {room.lastUpdate?.toDate ? room.lastUpdate.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[10px] truncate max-w-[180px] uppercase font-bold ${isSelected ? 'text-white/60' : isUnread ? 'text-black' : 'opacity-40'}`}>{room.lastMessage}</p>
                  {isUnread && !isSelected && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[7px] font-black uppercase text-red-500 tracking-tighter">New</span>
                      <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="p-6 lg:p-8 border-b flex justify-between items-center bg-white px-6 lg:px-10">
              <h4 className="font-serif italic text-xl">{selected.patientName}</h4>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Active Session</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-4" ref={scrollRef}>
              {messages.map((m, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: m.senderId === currentUser.uid ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className={`flex ${m.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex flex-col gap-1 max-w-[80%]">
                    <div className={`p-5 rounded-[2rem] text-sm ${m.senderId === currentUser.uid ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-gray-100 shadow-sm rounded-tl-none font-serif italic'}`}>{m.text}</div>
                    <span className={`text-[7px] font-bold uppercase opacity-30 ${m.senderId === currentUser.uid ? 'text-right mr-2' : 'ml-2'}`}>
                      {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Delivering...'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
            <form onSubmit={onSend} className="p-4 lg:p-8 border-t flex gap-2 lg:gap-4">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="flex-1 p-4 lg:p-5 bg-gray-50 rounded-[1.5rem] outline-none text-sm" />
              <button disabled={isSending} className={`p-4 lg:p-5 bg-black text-white rounded-[1.5rem] flex-shrink-0 transition-all ${isSending ? 'opacity-50 scale-95' : 'active:scale-90'}`}>
                <Send size={20}/>
              </button>
            </form>
          </>
        ) : <div className="flex-1 flex items-center justify-center opacity-20 italic">Select a conversation</div>}
      </div>
    </div>
  );
}