import React, { useMemo, useState } from 'react';
import { ActivityRecord, MonthlyStats, RecordType } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  UserPlus, 
  UserMinus, 
  Users, 
  Calendar,
  Filter,
  ArrowRight
} from 'lucide-react';

interface Props {
  allRecords: ActivityRecord[];
}

export default function Dashboard({ allRecords }: Props) {
  const [filterType, setFilterType] = useState<RecordType>('user');

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

  const statsByMonth = useMemo(() => {
    const filtered = allRecords.filter(r => r.type === filterType);
    const months = Array.from(new Set(filtered.map(r => r.yearMonth))).sort();
    
    const stats: MonthlyStats[] = [];
    
    for (let i = 0; i < months.length; i++) {
        const currentMonth = months[i];
        const prevMonthStr = getPreviousMonth(currentMonth);
        
        const currentRecords = filtered.filter(r => r.yearMonth === currentMonth);
        const prevRecords = filtered.filter(r => r.yearMonth === prevMonthStr);
        
        const currentSet = new Set(currentRecords.map(r => `${r.name}_${r.dob}`));
        const prevSet = new Set(prevRecords.map(r => `${r.name}_${r.dob}`));
        
        const newList = currentRecords.filter(r => !prevSet.has(`${r.name}_${r.dob}`));
        const rawTerminatedList = prevRecords.filter(r => !currentSet.has(`${r.name}_${r.dob}`));
        
        // Mark recontracts
        const newListWithMetadata = newList.map(person => {
          const hasPast = filtered.some(r => r.name === person.name && r.dob === person.dob && r.yearMonth < person.yearMonth);
          return { ...person, isRecontract: hasPast };
        });

        // Determine if terminated or just waiting (look ahead into all future records)
        const processedTerminatedList = rawTerminatedList.map(person => {
          const hasFuture = filtered.some(r => r.name === person.name && r.dob === person.dob && r.yearMonth > currentMonth);
          const status: 'terminated' | 'waiting' = (filterType === 'assistant' && hasFuture) ? 'waiting' : 'terminated';
          return { ...person, status };
        });

        stats.push({
            yearMonth: currentMonth,
            total: currentSet.size,
            newCount: newList.length,
            terminatedCount: rawTerminatedList.length,
            newList: newListWithMetadata,
            terminatedList: processedTerminatedList
        });
    }
    
    return stats;
  }, [allRecords, filterType]);

  const latestStats = statsByMonth[statsByMonth.length - 1];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">활동지원 관리 대시보드</h1>
          <p className="text-slate-500 font-medium">실인원 현황 및 월별 변동 추이 요약</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
          <button 
            onClick={() => setFilterType('user')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${filterType === 'user' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            서비스 이용자
          </button>
          <button 
            onClick={() => setFilterType('assistant')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${filterType === 'assistant' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            활동지원사
          </button>
        </div>
      </div>

      {latestStats ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              label="총 실인원" 
              value={latestStats.total} 
              subLabel={latestStats.yearMonth}
              icon={<Users className="w-5 h-5 text-indigo-600" />}
              accentColor="indigo"
            />
            <StatCard 
              label="이번달 신규" 
              value={latestStats.newCount} 
              subLabel="전월 비"
              icon={<UserPlus className="w-5 h-5 text-emerald-600" />}
              accentColor="emerald"
            />
            <StatCard 
              label={filterType === 'assistant' ? "이번달 연계 대기" : "이번달 종결"} 
              value={latestStats.terminatedCount} 
              subLabel="전월 비"
              icon={<UserMinus className="w-5 h-5 text-rose-600" />}
              accentColor="rose"
            />
            <StatCard 
              label="순증 인원" 
              value={latestStats.newCount - latestStats.terminatedCount} 
              subLabel="Latest"
              icon={<TrendingUp className="w-5 h-5 text-teal-600" />}
              accentColor="teal"
              format="signed"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-slate-800">월별 상세 변동 추이</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></span> 인원
                  </div>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={statsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="yearMonth" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 700}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 700}} />
                    <Tooltip 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '16px'}}
                    />
                    <Line type="monotone" dataKey="total" name="실인원" stroke="#4F46E5" strokeWidth={4} dot={{r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-slate-800">신규 및 종결 통계</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> 신규
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span className="w-2.5 h-2.5 bg-rose-400 rounded-full"></span> 종결
                  </div>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="yearMonth" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 700}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 700}} />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px'}} />
                    <Bar dataKey="newCount" name="신규" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="terminatedCount" name="종결" fill="#FB7185" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* New & Terminated Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  이번달 신규 상세
                </h3>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase tracking-tighter">{latestStats.yearMonth}</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest sticky top-0">
                    <tr>
                      <th className="px-6 py-3">이름</th>
                      <th className="px-6 py-3">생년월일</th>
                      <th className="px-6 py-3 text-right">구분</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {latestStats.newList.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 text-sm font-bold text-slate-700">
                          <div className="flex items-center gap-2">
                             {p.name}
                             {p.isRecontract && (
                               <span className="bg-amber-50 text-amber-600 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-tighter">재계약</span>
                             )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm font-medium text-slate-400">{p.dob}</td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-[10px] font-extrabold text-white bg-indigo-600 px-2.5 py-1 rounded-lg uppercase shadow-sm">신규</span>
                        </td>
                      </tr>
                    ))}
                    {latestStats.newList.length === 0 && (
                      <tr><td colSpan={3} className="py-20 text-center text-slate-300 text-sm font-bold uppercase tracking-widest">변동 사항 없음</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                  이번달 종결 상세
                </h3>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase tracking-tighter font-mono">{latestStats.yearMonth}</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest sticky top-0">
                    <tr>
                      <th className="px-6 py-3">이름</th>
                      <th className="px-6 py-3">생년월일</th>
                      <th className="px-6 py-3 text-right">구분</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {latestStats.terminatedList.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 text-sm font-bold text-slate-700">{p.name}</td>
                        <td className="py-4 px-6 text-sm font-medium text-slate-400">{p.dob}</td>
                        <td className="py-4 px-6 text-right">
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase ${p.status === 'waiting' ? 'text-amber-600 bg-amber-50 border border-amber-100' : 'text-rose-600 bg-rose-50 border border-rose-100'}`}>
                            {p.status === 'waiting' ? '연계 대기' : '종결'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {latestStats.terminatedList.length === 0 && (
                      <tr><td colSpan={3} className="py-20 text-center text-slate-300 text-sm font-bold uppercase tracking-widest">변동 사항 없음</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-24 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Calendar className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">분석할 데이터가 부족합니다.</h3>
            <p className="text-slate-500 font-medium mb-10 max-w-sm mx-auto leading-relaxed">월별 엑셀 파일을 업로드하면 이곳에서 자동 분석 결과를 확인할 수 있습니다.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  subLabel, 
  icon, 
  accentColor,
  format = 'normal'
}: { 
  label: string, 
  value: number, 
  subLabel: string, 
  icon: React.ReactNode, 
  accentColor: string,
  format?: 'normal' | 'signed'
}) {
  const accentClasses: Record<string, string> = {
    indigo: 'border-l-indigo-600',
    emerald: 'border-l-emerald-500',
    rose: 'border-l-rose-500',
    teal: 'border-l-teal-500'
  };

  return (
    <div className={`bg-white p-6 rounded-2xl border border-slate-200 border-l-4 shadow-sm ${accentClasses[accentColor]} transition-all hover:shadow-md hover:translate-y-[-2px] duration-300 group`}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-colors">
          {icon}
        </div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{subLabel}</span>
      </div>
      <div>
        <p className="text-slate-400 font-bold text-[10px] mb-1 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-black text-slate-800 tracking-tight">
          {format === 'signed' && value > 0 ? '+' : ''}{value.toLocaleString()}<span className="text-base font-bold ml-1 text-slate-300">명</span>
        </p>
      </div>
    </div>
  );
}
