import React, { useState, useEffect } from 'react';
import { auth, loginWithGoogle, logout, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, doc, getDocFromServer } from 'firebase/firestore';
import { ActivityRecord } from './types';
import { 
  Users, 
  LayoutDashboard, 
  Upload, 
  History, 
  LogOut, 
  LogIn,
  Activity,
  UserCheck,
  Smartphone,
  ExternalLink,
  Download,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import DataEntry from './components/DataEntry';
import SearchHistory from './components/SearchHistory';
import PersonnelList from './components/PersonnelList';
import SecurityInfo from './components/SecurityInfo';

type Tab = 'dashboard' | 'users' | 'assistants' | 'upload' | 'history' | 'security';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [allRecords, setAllRecords] = useState<ActivityRecord[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    // Check if in iframe
    setIsIframe(window.self !== window.top);

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setIsStandalone(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const [copied, setCopied] = useState(false);

  const handleOpenInNewTab = () => {
    // Open the clean, top-level site URL in a new tab
    const cleanUrl = window.location.origin;
    window.open(cleanUrl, '_blank');
  };

  const handleCopyLink = () => {
    const cleanUrl = window.location.origin;
    navigator.clipboard.writeText(cleanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setAllRecords([]);
      return;
    }

    const recordsPath = 'records';
    const q = query(collection(db, recordsPath), orderBy('yearMonth', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityRecord[];
      setAllRecords(records);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, recordsPath);
    });

    return unsubscribe;
  }, [user]);

  // Test connection as per guidelines
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans">
        <div className="max-w-md w-full bg-white p-10 rounded-2xl shadow-lg border border-slate-200 text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
            <Activity className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">활동지원 서비스 관리</h1>
          <p className="text-slate-500 mb-10 font-medium">관리자 계정으로 로그인하여 데이터를 관리하세요.</p>
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 py-3.5 px-4 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Google 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0 flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="font-extrabold text-slate-900 leading-tight text-lg tracking-tight">활동지원 관리</span>
          </div>

          <div className="space-y-1.5">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')}
              icon={<LayoutDashboard className="w-5 h-5" />}
              label="현황 대시보드"
            />
            <div className="pt-4 pb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">명단 관리</p>
            </div>
            <NavItem 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')}
              icon={<Users className="w-5 h-5" />}
              label="이용자 관리"
            />
            <NavItem 
              active={activeTab === 'assistants'} 
              onClick={() => setActiveTab('assistants')}
              icon={<UserCheck className="w-5 h-5" />}
              label="활동지원사 관리"
            />
            <div className="pt-4 pb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">시스템</p>
            </div>
            <NavItem 
              active={activeTab === 'upload'} 
              onClick={() => setActiveTab('upload')}
              icon={<Upload className="w-5 h-5" />}
              label="데이터 업로드"
            />
            <NavItem 
              active={activeTab === 'history'} 
              onClick={() => setActiveTab('history')}
              icon={<History className="w-5 h-5" />}
              label="개별 이력 검색"
            />

            <NavItem 
              active={activeTab === 'security'} 
              onClick={() => setActiveTab('security')} 
              icon={<ShieldCheck className="w-5 h-5" />}
              label="시스템 보안 설정"
            />

            {!isStandalone && (
              <div className="pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4 mb-3">설치 및 최적화</p>
                {isIframe ? (
                  <button
                    onClick={handleOpenInNewTab}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 group"
                  >
                    <ExternalLink className="w-5 h-5" />
                    <span className="text-sm">전체 창에서 설치</span>
                  </button>
                ) : isInstallable ? (
                  <button
                    onClick={handleInstallClick}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 group animate-bounce-subtle"
                  >
                    <Download className="w-5 h-5" />
                    <span className="text-sm">PC 앱 설치하기</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowInstallGuide(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all group"
                  >
                    <Smartphone className="w-5 h-5" />
                    <span className="text-sm">설치 방법 보기</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-slate-50 bg-slate-50/30">
          <div className="flex items-center gap-3 mb-6">
            <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-900 truncate tracking-tight">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{user.email?.split('@')[0]}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 text-slate-400 hover:text-rose-600 font-bold text-xs uppercase tracking-widest transition-colors py-2"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard allRecords={allRecords} />}
              {activeTab === 'users' && <PersonnelList type="user" allRecords={allRecords} />}
              {activeTab === 'assistants' && <PersonnelList type="assistant" allRecords={allRecords} />}
              {activeTab === 'upload' && <DataEntry />}
              {activeTab === 'history' && <SearchHistory allRecords={allRecords} />}
              {activeTab === 'security' && <SecurityInfo />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      {/* Install Guide Modal */}
      <AnimatePresence>
        {showInstallGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInstallGuide(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-indigo-150 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Download className="w-6 h-6 animate-bounce" />
                  </div>
                  <button 
                    onClick={() => setShowInstallGuide(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                  >
                    <span className="text-xl font-bold">✕</span>
                  </button>
                </div>

                <h3 className="text-2xl font-black text-slate-900 mb-2">바탕화면에 전용 프로그램으로 설치하기</h3>
                <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed">
                  구글 AI 스튜디오를 켜놓지 않고도 바탕화면에서 아이콘 클릭 한 번으로 간편하게 실행할 수 있습니다.
                </p>

                {isIframe ? (
                  <div className="space-y-5">
                    {/* Crucial Explainer for AI Studio installation loop */}
                    <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
                      <p className="text-sm font-bold text-rose-700">⚠️ 설치 전 반드시 확인해 주세요!</p>
                      <p className="text-[12px] text-rose-600 leading-relaxed font-semibold">
                        지금 보시는 화면은 <span className="underline">구글 AI 스튜디오 개발 에디터 내부</span> 입니다.<br />
                        여기서 크롬 메뉴를 통해 설치하시면 이 시스템이 아닌 "구글 AI 스튜디오"가 바로가기 아이콘으로 등록됩니다.
                      </p>
                      <p className="text-[12px] text-rose-600 leading-relaxed">
                        아래의 <strong>[전체 창에서 열기]</strong>를 눌러 독립된 전용 인터넷 창을 띄운 다음 설치해야 온전한 독립 관리 앱이 생성됩니다.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleOpenInNewTab}
                        className="flex-1 flex items-center justify-center gap-2.5 bg-indigo-600 py-3.5 px-6 rounded-xl font-black text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                      >
                        <ExternalLink className="w-5 h-5" />
                        <span>1단계: 전체 창으로 열기</span>
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold transition-all border ${
                          copied 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        {copied ? <Check className="w-5 h-5 animate-pulse" /> : <Copy className="w-5 h-5" />}
                        <span className="text-sm">{copied ? "복사됨!" : "주소 복사"}</span>
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl text-center">
                      <p className="text-[11px] text-slate-500 font-medium">
                        * 주소 복사 후 카카오톡이나 메모장에 저장해 두고 사용하면 AI 스튜디오를 켜지 않아도 직접 실행할 수 있습니다.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Explainer for standalone browser user */}
                    <div className="p-5 bg-indigo-50 border border-indigo-150 rounded-2xl">
                      <p className="text-sm font-bold text-indigo-800 mb-1">🎉 전용 웹 주소로 안전하게 접속되었습니다!</p>
                      <p className="text-[12px] text-indigo-600 leading-relaxed font-semibold">
                        이제 구글 AI 스튜디오의 영향 없이 보안 유지 상태에서 완벽히 독립 실행됩니다. PC 브라우저가 사용자 인증 정보를 안전하게 보관하므로 자동 로그인도 유지됩니다.
                      </p>
                    </div>

                    {isInstallable ? (
                      <button
                        onClick={() => {
                          handleInstallClick();
                          setShowInstallGuide(false);
                        }}
                        className="w-full flex items-center justify-center gap-3 bg-indigo-600 py-4 px-6 rounded-2xl font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all animate-pulse"
                      >
                        <Smartphone className="w-5 h-5" />
                        <span>바탕화면에 설치 아이콘 만들기</span>
                      </button>
                    ) : (
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <p className="text-xs font-black text-indigo-400 uppercase tracking-widest pl-1">PC 설치 방법</p>
                          
                          <div className="space-y-4">
                            <div className="flex gap-4">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">1</div>
                              <div>
                                <p className="text-sm font-bold text-slate-700 mb-0.5">상단 주소창 우측 아이콘</p>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                  주소창의 <span className="font-bold text-indigo-600">[모니터와 화살표 모양 설치 아이콘]</span>이 보인다면 클릭해 주세요.
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-4">
                              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">2</div>
                              <div>
                                <p className="text-sm font-bold text-slate-700 mb-0.5">브라우저 우측 상단 메뉴(⋮) 클릭</p>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                  메뉴 버튼 &gt; <span className="font-bold text-slate-700">저장 및 공유</span> &gt; <span className="font-bold text-indigo-600">페이지를 앱으로 설치</span>를 클릭하세요.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-1">
                          <p className="text-xs font-bold text-amber-800">📌 꼭 기억해 주세요!</p>
                          <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                            만약 이전에 메인 창을 설치하여 "Google AI Studio" 바로가기가 컴퓨터 바탕화면에 생성되었다면, 그 아이콘은 <strong>우클릭 후 삭제</strong>해 주신 후 여기서 안전하게 재설치 하시기 바랍니다!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 border-none' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
