import React, { useState, useMemo } from 'react';
import { ActivityRecord } from '../types';
import { Search, Calendar, User, UserCheck, UserMinus, Clock, Filter, Users, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';

interface Props {
  allRecords: ActivityRecord[];
}

export default function SearchHistory({ allRecords }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDob, setSearchDob] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    setConfirmDeleteId(null);
    const path = `records/${id}`;
    
    try {
      await deleteDoc(doc(db, 'records', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredHistory = useMemo(() => {
    if (!searchTerm && !searchDob) return [];
    
    return allRecords.filter(r => {
      const nameMatch = searchTerm ? r.name.includes(searchTerm) : true;
      const dobMatch = searchDob ? r.dob.includes(searchDob) : true;
      return nameMatch && dobMatch;
    }).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  }, [allRecords, searchTerm, searchDob]);

  // Group by person
  const groupedHistory = useMemo(() => {
    const groups: Record<string, ActivityRecord[]> = {};
    filteredHistory.forEach(r => {
      const key = `${r.type}_${r.name}_${r.dob}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }, [filteredHistory]);

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Search className="w-6 h-6 text-indigo-600" />
          </div>
          개별 이용 이력 검색
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative group">
            <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="이름 입력 (예: 홍길동)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 py-4.5 px-14 rounded-2xl font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
            />
          </div>
          <div className="relative group">
            <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="생년월일 입력 (예: 800812)"
              value={searchDob}
              onChange={(e) => setSearchDob(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 py-4.5 px-14 rounded-2xl font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {(Object.entries(groupedHistory) as [string, ActivityRecord[]][]).map(([key, records]) => {
          const person = records[0];
          const firstMonth = [...records].sort((a,b) => a.yearMonth.localeCompare(b.yearMonth))[0].yearMonth;
          const lastMonth = recordToLatest(records).yearMonth;

          return (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              key={key}
              className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500"
            >
              <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 ${person.type === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white'}`}>
                    {person.type === 'user' ? <UserCheck className="w-7 h-7" /> : <Users className="w-7 h-7" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{person.name} <span className="text-base font-bold text-slate-300 ml-1">{person.dob}</span></h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${person.type === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                        {person.type === 'user' ? '서비스 이용자' : '활동지원사'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-8 border-l border-slate-200 pl-8 h-10 items-center">
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">최초 등록</p>
                    <p className="text-sm font-black text-slate-700">{firstMonth}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">최근 활동</p>
                    <p className="text-sm font-black text-slate-700">{lastMonth}</p>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-indigo-500" />
                  월별 활동 타임라인
                </p>
                <div className="flex flex-wrap gap-3">
                  {records.map((r, i) => (
                    <div key={r.id} className="group relative">
                      <div className={`flex items-center gap-2 bg-white border px-4 py-2.5 rounded-xl shadow-sm transition-all duration-300 ${confirmDeleteId === r.id ? 'border-rose-200 bg-rose-50' : 'border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}>
                        <span className={`text-xs font-black tabular-nums ${confirmDeleteId === r.id ? 'text-rose-700' : 'text-slate-600'}`}>{r.yearMonth}</span>
                        
                        {confirmDeleteId === r.id ? (
                          <div className="flex items-center gap-1 animate-in slide-in-from-right-1">
                            <button 
                              onClick={() => handleDelete(r.id)}
                              disabled={isDeleting === r.id}
                              className="text-[10px] font-black text-rose-600 hover:text-rose-700 px-1"
                            >
                              삭제
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[10px] font-black text-slate-400 hover:text-slate-600 px-1"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setConfirmDeleteId(r.id)}
                            disabled={isDeleting === r.id}
                            className="ml-1 text-slate-200 hover:text-rose-500 transition-colors disabled:opacity-50"
                          >
                            {isDeleting === r.id ? (
                              <div className="w-3 h-3 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}

        {(searchTerm || searchDob) && Object.keys(groupedHistory).length === 0 && (
          <div className="text-center py-24 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 px-4">
              <Filter className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-900 font-black text-xl mb-2">일치하는 정보가 없습니다.</p>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">이름이나 생년월일을 다시 확인해 주세요.</p>
          </div>
        )}
        
        {!searchTerm && !searchDob && (
          <div className="text-center py-32 bg-slate-50/50 rounded-[40px] border border-slate-100">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Search className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-[0.3em]">이용자 정보를 검색해 주세요</p>
          </div>
        )}
      </div>
    </div>
  );
}

function recordToLatest(records: ActivityRecord[]) {
    return [...records].sort((a,b) => b.yearMonth.localeCompare(a.yearMonth))[0];
}
