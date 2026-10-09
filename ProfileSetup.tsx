import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, ArrowRight, Clipboard } from 'lucide-react';
import { UserProfile } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface ProfileSetupProps {
  user: UserProfile;
  onComplete: (user: UserProfile) => void;
}

export default function ProfileSetup({ user, onComplete }: ProfileSetupProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    birthday: '',
    height: '',
    weight: '',
    medicalHistory: ''
  });

  const calculateAge = (birthday: string): string => {
    if (!birthday) return '';
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age.toString() : '0';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatedData = {
        ...formData,
        profileCompleted: true
      };
      await updateDoc(doc(db, 'users', user.uid), updatedData);
      onComplete({ ...user, ...updatedData });
    } catch (err) {
      console.error(err);
      alert("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white border border-gray-100 rounded-[3rem] shadow-2xl p-10 lg:p-16"
      >
        <header className="text-center mb-12">
          <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <User size={32} />
          </div>
          <h2 className="text-4xl font-serif italic mb-2">Profile Setup</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Please complete your medical profile to continue</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-30 px-2 tracking-widest">Full Name</label>
              <input required type="text" placeholder="Juan Dela Cruz" className="w-full p-5 bg-gray-50 rounded-2xl outline-none focus:bg-white border focus:border-black transition-all text-sm" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-30 px-2 tracking-widest">Birthday</label>
              <input 
                required 
                type="date" 
                className="w-full p-5 bg-gray-50 rounded-2xl outline-none focus:bg-white border focus:border-black transition-all text-sm" 
                value={formData.birthday} 
                onChange={e => {
                  const bday = e.target.value;
                  setFormData({
                    ...formData, 
                    birthday: bday,
                    age: calculateAge(bday)
                  });
                }} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-30 px-2 tracking-widest">Age</label>
              <input readOnly type="number" placeholder="Calculated" className="w-full p-5 bg-gray-100 rounded-2xl outline-none border border-transparent transition-all text-sm opacity-60 cursor-not-allowed" value={formData.age} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-30 px-2 tracking-widest">Height</label>
                <input required type="text" placeholder="170cm" className="w-full p-5 bg-gray-50 rounded-2xl outline-none focus:bg-white border focus:border-black transition-all text-sm" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-30 px-2 tracking-widest">Weight</label>
                <input required type="text" placeholder="65kg" className="w-full p-5 bg-gray-50 rounded-2xl outline-none focus:bg-white border focus:border-black transition-all text-sm" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase opacity-30 px-2 tracking-widest flex items-center gap-2">
              <Clipboard size={12} /> Medical History (Dating Sakit)
            </label>
            <textarea 
              placeholder="List any conditions (Diabetes, Hypertension, etc.)" 
              className="w-full p-6 bg-gray-50 rounded-3xl h-32 outline-none focus:bg-white border focus:border-black transition-all text-sm font-serif italic"
              value={formData.medicalHistory}
              onChange={e => setFormData({...formData, medicalHistory: e.target.value})}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-6 bg-black text-white rounded-full font-bold uppercase text-[10px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? "Saving Records..." : <>Enter Portal <ArrowRight size={16} /></>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}