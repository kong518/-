import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Upload, AlertCircle, CheckCircle2, FileText, Trash2, Send } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedRow {
  연월: string;
  이름: string;
  생년월일: string;
  type?: 'user' | 'assistant';
  partnerName?: string;
  partnerDob?: string;
}

function parseYearMonth(val: any, defaultVal: string): string {
  if (!val) return defaultVal;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4})[-/.]?(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return defaultVal;
}

function cleanDob(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    const y = String(val.getFullYear()).slice(-2);
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  let str = String(val).trim();
  const digitsOnly = str.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 6) {
    return digitsOnly;
  }
  if (digitsOnly.length === 8 && (digitsOnly.startsWith('19') || digitsOnly.startsWith('20'))) {
    return digitsOnly.slice(2);
  }
  if (str.includes('-') || str.includes('/') || str.includes('.')) {
    const parsedDate = Date.parse(str);
    if (!isNaN(parsedDate)) {
      const dObj = new Date(parsedDate);
      const y = String(dObj.getFullYear()).slice(-2);
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return `${y}${m}${d}`;
    }
  }
  return digitsOnly;
}

export default function DataEntry() {
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().slice(0, 7));
  const [type, setType] = useState<'user' | 'assistant'>('user');
  const [inputData, setInputData] = useState<ParsedRow[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'none', message: string }>({ type: 'none', message: '' });
  const [isUploading, setIsUploading] = useState(false);

  // Parse Excel file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus({ type: 'none', message: '' });
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Let's read both header styles
        const rows2D = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        let parsed: ParsedRow[] = [];

        // Scan first 10 rows to find header row dynamically
        let headerRowIndex = 0;
        let isLinkedFormat = false;
        
        for (let r = 0; r < Math.min(rows2D.length, 10); r++) {
          const row = rows2D[r];
          if (!row) continue;
          const rowStr = row.map(cell => String(cell || '')).join(' ');
          if (rowStr.includes('대상자') || rowStr.includes('제공인력') || rowStr.includes('결제일시') || rowStr.includes('생년월일')) {
            headerRowIndex = r;
          }
          if (rowStr.includes('대상자') && rowStr.includes('제공인력')) {
            isLinkedFormat = true;
          }
        }

        // Also if we didn't find headers, but rows have length > 10 and we have some content in column B (index 1) and Column J (index 9)
        if (!isLinkedFormat && rows2D.length > 1) {
          const sampleRows = rows2D.slice(1, 10);
          const hasLinkedData = sampleRows.some(row => row && row.length > 10 && row[1] && row[9]);
          if (hasLinkedData) {
            isLinkedFormat = true;
          }
        }

        if (isLinkedFormat) {
          // New format: Column B = 대상자명, Column C = 이용자 생년월일, Column J = 제공인력명, Column K = 활동지원사 생년월일, Column Q = 결제 일시
          // Skip header row
          for (let i = headerRowIndex + 1; i < rows2D.length; i++) {
            const row = rows2D[i];
            if (!row) continue;

            const userName = String(row[1] || '').trim();
            const userDobVal = String(row[2] || '').trim();
            const assistantName = String(row[9] || '').trim();
            const assistantDobVal = String(row[10] || '').trim();
            const startTime = row[16];

            // If it's a header row itself (sometimes there are duplicate header rows or total rows)
            if (userName === '대상자명' || userName === '이름' || assistantName === '제공인력명') {
              continue;
            }

            const ym = parseYearMonth(startTime, yearMonth);
            const userDob = cleanDob(userDobVal);
            const assistantDob = cleanDob(assistantDobVal);

            // Same row means they are linked
            if (userName && userDob) {
              parsed.push({
                연월: ym,
                이름: userName,
                생년월일: userDob,
                type: 'user',
                partnerName: assistantName || '',
                partnerDob: assistantDob || ''
              });
            }

            if (assistantName && assistantDob) {
              parsed.push({
                연월: ym,
                이름: assistantName,
                생년월일: assistantDob,
                type: 'assistant',
                partnerName: userName || '',
                partnerDob: userDob || ''
              });
            }
          }
        } else {
          // Old single target structure
          const data = XLSX.utils.sheet_to_json(ws) as any[];
          parsed = data.map(row => ({
            연월: String(row['연월'] || yearMonth),
            이름: String(row['이름'] || '').trim(),
            생년월일: cleanDob(row['생년월일']),
            type: type,
            partnerName: '',
            partnerDob: ''
          })).filter(r => r.이름 && r.생년월일);
        }

        if (parsed.length === 0) throw new Error("분석된 유효 데이터가 없습니다. 업로드할 양식 컬럼(B열 대상자명, C열 이용자 생년월일, J열 제공인력명, K열 활동지원사 생년월일, Q열 결제일시)을 확인해 주세요.");
        
        // Deduplicate parsed records (중복 제거)
        const seen = new Set<string>();
        const uniqueParsed: ParsedRow[] = [];
        for (const item of parsed) {
          const currentType = item.type || type;
          const key = `${item.연월}_${currentType}_${item.이름}_${item.생년월일}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueParsed.push(item);
          } else {
            // If already exists but this one has partner info, update the existing one
            const idx = uniqueParsed.findIndex(x => {
              const xType = x.type || type;
              return `${x.연월}_${xType}_${x.이름}_${x.생년월일}` === key;
            });
            if (idx !== -1) {
              if (item.partnerName && !uniqueParsed[idx].partnerName) {
                uniqueParsed[idx].partnerName = item.partnerName;
                uniqueParsed[idx].partnerDob = item.partnerDob;
              }
            }
          }
        }

        setInputData(uniqueParsed);
        setStatus({ 
          type: 'success', 
          message: `엑셀 파일 분석 완료! 총 ${uniqueParsed.length}명의 데이터가 해석되어 준비되었습니다. 아래 미리보기를 확인하신 뒤 '확정 및 데이터베이스 저장' 버튼을 꼭 클릭해야 반영됩니다!` 
        });
      } catch (err: any) {
        setStatus({ type: 'error', message: `엑셀 해석 오류: ${err.message}` });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Parse manually pasted data (tab/space separated)
  const handlePaste = (text: string) => {
    try {
      const lines = text.split('\n').filter(l => l.trim());
      const parsed = lines.map((line): ParsedRow | null => {
        // Handle tabs or multiple spaces as delimiters
        const parts = line.split(/[\t\s]+/).filter(p => p.trim());
        if (parts.length >= 3) {
          return { 
            연월: parts[0], 
            이름: parts[1], 
            생년월일: cleanDob(parts[2]), 
            type: type, 
            partnerName: '', 
            partnerDob: '' 
          };
        } else if (parts.length === 2) {
          return { 
            연월: yearMonth, 
            이름: parts[0], 
            생년월일: cleanDob(parts[1]), 
            type: type, 
            partnerName: '', 
            partnerDob: '' 
          };
        }
        return null;
      }).filter((r): r is ParsedRow => r !== null);

      if (parsed.length > 0) {
        setInputData([...inputData, ...parsed]);
      }
    } catch (err) {
      setStatus({ type: 'error', message: '붙여넣기 데이터 해석 실패' });
    }
  };

  const removeItem = (index: number) => {
    setInputData(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (inputData.length === 0) return;
    setIsUploading(true);
    setStatus({ type: 'none', message: '' });

    try {
      let count = 0;
      for (const row of inputData) {
        const currentType = row.type || type;
        // Deterministic ID including partner info to avoid collision and allow smooth overwrites
        const recordId = `${row.연월}_${currentType}_${row.이름}_${row.생년월일}_${row.partnerName || ''}`;
        const recordPath = `records/${recordId}`;
        try {
          await setDoc(doc(db, 'records', recordId), {
            yearMonth: row.연월,
            name: row.이름,
            dob: row.생년월일,
            type: currentType,
            partnerName: row.partnerName || '',
            partnerDob: row.partnerDob || '',
            uploadedAt: serverTimestamp()
          });
          count++;
        } catch (err: any) {
          handleFirestoreError(err, OperationType.WRITE, recordPath);
        }
      }
      setStatus({ type: 'success', message: `${count}개의 데이터를 성공적으로 업로드했습니다.` });
      setInputData([]);
    } catch (err: any) {
      // If it's our JSON error info, parse it for a cleaner UI message if possible
      let displayMessage = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) displayMessage = `권한 오류 (${parsed.operationType}): ${parsed.error}`;
      } catch {
        // Not a JSON error
      }
      setStatus({ type: 'error', message: '업로드 중 오류가 발생했습니다: ' + displayMessage });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Upload className="w-6 h-6 text-indigo-600" />
          </div>
          데이터 업로드
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">대상 선택</label>
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
              <button 
                onClick={() => setType('user')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${type === 'user' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
              >
                서비스 이용자
              </button>
              <button 
                onClick={() => setType('assistant')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${type === 'assistant' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
              >
                활동지원사
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">기준 연월</label>
            <input 
              type="month" 
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 py-3.5 px-5 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
            />
          </div>
        </div>

        <div className="relative group">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="border-2 border-dashed border-slate-200 group-hover:border-indigo-400 rounded-3xl p-16 text-center transition-all bg-slate-50/50 group-hover:bg-indigo-50/30">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6 border border-slate-100 group-hover:scale-110 transition-transform">
              <FileText className="w-8 h-8 text-slate-300 group-hover:text-indigo-500" />
            </div>
            <p className="text-slate-900 text-lg font-black mb-2 tracking-tight">클릭하여 엑셀 파일 업로드</p>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest leading-none">Excel (.xlsx, .csv)</p>
          </div>
        </div>

        {status.type !== 'none' && (
          <div className={`mt-6 p-5 rounded-2xl flex items-center gap-4 border shadow-sm animate-in fade-in slide-in-from-top-1 ${
            status.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${status.type === 'success' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              {status.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <AlertCircle className="w-6 h-6 text-rose-600" />}
            </div>
            <p className="font-bold text-sm tracking-tight leading-relaxed">{status.message}</p>
          </div>
        )}
      </div>

      {/* Manual Entry Section - Styled like the dark box in design */}
      <div className="bg-indigo-900 p-8 rounded-[32px] shadow-2xl shadow-indigo-200">
        <div className="mb-6">
          <h4 className="text-white font-black text-xl mb-1 flex items-center gap-2">
            데이터 일괄 붙여넣기
            <span className="text-[10px] bg-indigo-800 text-indigo-300 px-2 py-1 rounded-full uppercase font-bold border border-indigo-700">Quick Add</span>
          </h4>
          <p className="text-indigo-300 text-sm font-medium">한 줄에 한 명씩 데이터를 복사하여 붙여넣으세요 (연월 이름 생년월일)</p>
        </div>
        <textarea
          placeholder="2026-01  홍길동  860101"
          className="w-full h-40 bg-indigo-800/50 border border-indigo-700 p-6 rounded-2xl font-mono text-sm text-indigo-100 placeholder:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all shadow-inner resize-none mb-6"
          onChange={(e) => {
            handlePaste(e.target.value);
            e.target.value = '';
          }}
        />
        
        <div className="flex items-center gap-4 text-indigo-300 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
            중합 방지 활성화
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
            6자리 생년월일 권장
          </div>
        </div>
      </div>

      {inputData.length > 0 && (
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">업로드 미리보기</h3>
              <p className="text-sm text-slate-500 font-medium">총 <span className="text-indigo-600 font-black">{inputData.length}명</span>의 데이터가 준비됨</p>
            </div>
            <button 
              onClick={handleSave}
              disabled={isUploading}
              className="flex items-center gap-3 bg-indigo-600 text-white py-4 px-10 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-100 group active:scale-95"
            >
              {isUploading ? <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></span> : <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              {isUploading ? '저장 중...' : '확정 및 데이터베이스 저장'}
            </button>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-white sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">연월</th>
                  <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">이름</th>
                  <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">생년월일</th>
                  <th className="py-4 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {inputData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-5 px-8 text-sm font-bold text-slate-400 tabular-nums">{row.연월}</td>
                    <td className="py-5 px-8 text-sm font-black text-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{row.이름}</span>
                        {row.type && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${row.type === 'user' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                            {row.type === 'user' ? '이용자' : '지원사'}
                          </span>
                        )}
                        {row.partnerName && (
                          <span className="text-[10px] text-indigo-500 bg-indigo-50/50 border border-indigo-100/30 px-2 py-0.5 rounded-lg font-bold">
                            🤝 연계: {row.partnerName} ({row.partnerDob})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-5 px-8 text-sm font-bold text-slate-400 tabular-nums">{row.생년월일}</td>
                    <td className="py-5 px-8 text-right">
                      <button onClick={() => removeItem(i)} className="text-slate-200 hover:text-rose-500 transition-colors bg-slate-50 group-hover:bg-rose-50 p-2 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {status.type !== 'none' && (
        <div className={`p-6 rounded-2xl flex items-center gap-4 border shadow-sm animate-in fade-in slide-in-from-top-1 ${
          status.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${status.type === 'success' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {status.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <AlertCircle className="w-6 h-6 text-rose-600" />}
          </div>
          <p className="font-bold tracking-tight">{status.message}</p>
        </div>
      )}
    </div>
  );
}
