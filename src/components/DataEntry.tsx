import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Upload, AlertCircle, CheckCircle2, FileText, Trash2, Send } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedRow {
  연월: string;
  이름: string;
  생년월일: string;
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

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const parsed = data.map(row => ({
          연월: String(row['연월'] || yearMonth),
          이름: String(row['이름'] || '').trim(),
          생년월일: String(row['생년월일'] || '').trim(),
        })).filter(r => r.이름 && r.생년월일);

        if (parsed.length === 0) throw new Error("유효한 데이터가 없습니다. 매핑 필드를 확인하세요 (연월, 이름, 생년월일).");
        
        setInputData(parsed);
        setStatus({ type: 'none', message: '' });
      } catch (err: any) {
        setStatus({ type: 'error', message: err.message });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Parse manually pasted data (tab/space separated)
  const handlePaste = (text: string) => {
    try {
      const lines = text.split('\n').filter(l => l.trim());
      const parsed = lines.map(line => {
        // Handle tabs or multiple spaces as delimiters
        const parts = line.split(/[\t\s]+/).filter(p => p.trim());
        if (parts.length >= 3) {
          return { 연월: parts[0], 이름: parts[1], 생년월일: parts[2] };
        } else if (parts.length === 2) {
          return { 연월: yearMonth, 이름: parts[0], 생년월일: parts[1] };
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
        // Deterministic ID to prevent duplicates for specific month/type/person
        const recordId = `${row.연월}_${type}_${row.이름}_${row.생년월일}`;
        const recordPath = `records/${recordId}`;
        try {
          await setDoc(doc(db, 'records', recordId), {
            yearMonth: row.연월,
            name: row.이름,
            dob: row.생년월일,
            type: type,
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
                    <td className="py-5 px-8 text-sm font-black text-slate-800">{row.이름}</td>
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
