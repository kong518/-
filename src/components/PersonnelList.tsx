import React, { useMemo, useState } from 'react';
import { ActivityRecord, RecordType } from '../types';
import { Users, UserCheck, Calendar, Filter, Trash2, Download } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

interface Props {
  type: RecordType;
  allRecords: ActivityRecord[];
}

export default function PersonnelList({ type, allRecords }: Props) {
  const filteredRecords = useMemo(() => allRecords.filter(r => r.type === type), [allRecords, type]);
  const months = useMemo(() => Array.from(new Set(filteredRecords.map(r => r.yearMonth))).sort().reverse(), [filteredRecords]);
  
  const [selectedMonth, setSelectedMonth] = useState<string>(months[0] || '');

  // Reset selected month when months change (e.g. data upload)
  React.useEffect(() => {
    if (!selectedMonth && months.length > 0) {
      setSelectedMonth(months[0]);
    }
  }, [months]);

  const currentRoster = useMemo(() => 
    filteredRecords.filter(r => r.yearMonth === selectedMonth)
    .sort((a, b) => a.name.localeCompare(b.name)), 
    [filteredRecords, selectedMonth]
  );

  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'none', message: string }>({ type: 'none', message: '' });
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const getPreviousMonth = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  };

  const isRecontract = (person: ActivityRecord) => {
    const prevMonth = getPreviousMonth(person.yearMonth);
    const history = filteredRecords.filter(r => r.name === person.name && r.dob === person.dob);
    
    const hasPast = history.some(r => r.yearMonth < person.yearMonth);
    const hasImmediatePast = history.some(r => r.yearMonth === prevMonth);
    
    return hasPast && !hasImmediatePast;
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === currentRoster.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentRoster.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    setConfirmDeleteId(null);
    setStatus({ type: 'none', message: '' });
    const path = `records/${id}`;
    
    try {
      await deleteDoc(doc(db, 'records', id));
      setStatus({ type: 'success', message: '성공적으로 삭제되었습니다.' });
      setTimeout(() => setStatus({ type: 'none', message: '' }), 3000);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      console.error("Delete error details:", err);
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (e: any) {
        let displayMessage = e.message;
        try {
          const parsed = JSON.parse(e.message);
          if (parsed.error) displayMessage = `권한 부족 (${parsed.operationType})`;
        } catch { }
        setStatus({ type: 'error', message: `삭제 실패: ${displayMessage}` });
      }
    } finally {
      setIsDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}개의 기록을 모두 삭제하시겠습니까?`)) return;

    setIsBulkDeleting(true);
    setStatus({ type: 'none', message: '' });
    let successCount = 0;
    
    try {
      const idsToDelete = Array.from(selectedIds);
      for (const id of idsToDelete) {
        await deleteDoc(doc(db, 'records', id as string));
        successCount++;
      }
      setStatus({ type: 'success', message: `${successCount}개의 기록이 삭제되었습니다.` });
      setSelectedIds(new Set());
      setTimeout(() => setStatus({ type: 'none', message: '' }), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: `일부 삭제 실패: ${err.message}` });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const exportToExcel = () => {
    const data = currentRoster.map(r => ({
      연월: r.yearMonth,
      이름: r.name,
      생년월일: r.dob
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "명단");
    XLSX.writeFile(workbook, `${selectedMonth}_${type === 'user' ? '이용자' : '활동지원사'}_명단.xlsx`);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
            {type === 'user' ? '이용자 명단 관리' : '활동지원사 명단 관리'}
          </h1>
          <p className="text-slate-500 font-medium">월별 상세 명단 확인 및 데이터 관리</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-2 bg-rose-500 text-white py-3 px-6 rounded-2xl font-black text-sm hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 disabled:opacity-50 animate-in fade-in slide-in-from-right-4"
            >
              {isBulkDeleting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {selectedIds.size}개 선택 삭제
            </button>
          )}

          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 px-3 text-slate-400">
              <Filter className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">조회 월:</span>
            </div>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none pr-4"
            >
              {months.map(m => <option key={m} value={m}>{m}</option>)}
              {months.length === 0 && <option value="">데이터 없음</option>}
            </select>
          </div>

          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-white border border-slate-200 py-3 px-6 rounded-2xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Excel 다운로드
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${type === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white'}`}>
                {type === 'user' ? <Users className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedMonth} {type === 'user' ? '이용자' : '활동지원사'} 명단</h3>
                <p className="text-sm text-slate-400 font-medium tracking-tight">총 <span className="font-black text-indigo-600">{currentRoster.length}명</span>이 등록되어 있습니다.</p>
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white sticky top-0 border-b border-slate-100">
               <tr>
                  <th className="py-4 px-8 w-14">
                    <div className="flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={currentRoster.length > 0 && selectedIds.size === currentRoster.length}
                        onChange={toggleSelectAll}
                        className="w-5 h-5 rounded-lg border-2 border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      />
                    </div>
                  </th>
                  <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">이름</th>
                  <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">생년월일</th>
                  <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">활동 유형</th>
                  <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">관리</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
               {currentRoster.map((p, i) => (
                  <tr key={p.id} className={`group transition-colors ${selectedIds.has(p.id) ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                    <td className="py-5 px-8">
                      <div className="flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="w-5 h-5 rounded-lg border-2 border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                        />
                      </div>
                    </td>
                    <td className="py-5 px-8 text-sm font-black text-slate-800">
                      <div className="flex items-center gap-2">
                        {p.name}
                        {isRecontract(p) && (
                          <span className="bg-amber-50 text-amber-600 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-200 animate-pulse">
                            재계약
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-5 px-8 text-sm font-bold text-slate-400 tabular-nums">{p.dob}</td>
                    <td className="py-5 px-8 text-sm">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${type === 'user' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                        {type === 'user' ? 'USER' : 'ASSISTANT'}
                      </span>
                    </td>
                    <td className="py-5 px-8 text-right">
                       {confirmDeleteId === p.id ? (
                         <div className="flex items-center justify-end gap-2 animate-in zoom-in-95 duration-200">
                           <button 
                             onClick={() => handleDelete(p.id)}
                             className="bg-rose-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg hover:bg-rose-600 transition-colors shadow-sm"
                           >
                              삭제 확정
                           </button>
                           <button 
                             onClick={() => setConfirmDeleteId(null)}
                             className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                           >
                              취소
                           </button>
                         </div>
                       ) : (
                         <button 
                           onClick={() => setConfirmDeleteId(p.id)} 
                           disabled={isDeleting !== null}
                           className={`text-slate-200 hover:text-rose-500 transition-colors p-2 rounded-lg bg-slate-50 group-hover:bg-rose-50 disabled:opacity-50 ${isDeleting === p.id ? 'animate-pulse' : ''}`}
                         >
                            {isDeleting === p.id ? (
                              <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                         </button>
                       )}
                    </td>
                  </tr>
               ))}
               {currentRoster.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-32 text-center text-slate-300 font-bold uppercase tracking-[0.3em]">
                       표시할 명단이 없습니다.
                    </td>
                  </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>

      {status.type !== 'none' && (
        <div className={`p-6 rounded-2xl flex items-center gap-4 border shadow-sm animate-in fade-in slide-in-from-top-1 ${
          status.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${status.type === 'success' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${status.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white font-bold text-xs`}>
              {status.type === 'success' ? '✓' : '!'}
            </div>
          </div>
          <p className="font-bold tracking-tight">{status.message}</p>
        </div>
      )}
    </div>
  );
}
