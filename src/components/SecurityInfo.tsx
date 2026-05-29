import React from 'react';
import { ShieldCheck, Lock, EyeOff, Server, HardDrive } from 'lucide-react';
import { motion } from 'motion/react';

const SecurityInfo: React.FC = () => {
  const securityFeatures = [
    {
      icon: <Lock className="w-5 h-5 text-indigo-500" />,
      title: "조직 내 접근 제한",
      desc: "suwonrehab.or.kr 도메인 전용 계정으로 로그인한 직원만 데이터 열람이 가능합니다."
    },
    {
      icon: <EyeOff className="w-5 h-5 text-rose-500" />,
      title: "검색 엔진 노출 차단",
      desc: "강력한 'noindex' 정책이 적용되어 구글, 네이버 등 어떤 검색 엔진에서도 시스템과 데이터가 검색되지 않습니다."
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
      title: "실시간 암호화 및 보호",
      desc: "모든 정보는 군사급 암호화 통신을 통해 관리되며, 허가되지 않은 접근은 즉시 차단됩니다."
    },
    {
      icon: <Server className="w-5 h-5 text-slate-500" />,
      title: "안전한 클라우드 인프라",
      desc: "Google의 보안 인프라(Firebase)를 사용하여 물리적 보안과 백업을 보장합니다."
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
        <div className="relative z-10">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black mb-2">통합 보안 시스템 가동 중</h2>
          <p className="text-indigo-100 font-medium leading-relaxed max-w-md">
            본 시스템은 사회복지기관의 개인정보보호 가이드라인을 준수하기 위해 
            데이터베이스 수준의 강력한 보안 정책이 적용되어 있습니다.
          </p>
        </div>
        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityFeatures.map((feature, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm flex gap-4"
          >
            <div className="shrink-0 p-3 bg-slate-50 rounded-xl">
              {feature.icon}
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">{feature.title}</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl">
        <div className="flex gap-3 mb-3">
          <HardDrive className="w-5 h-5 text-amber-600" />
          <h4 className="font-bold text-amber-900">사용자 권장 보안 수칙</h4>
        </div>
        <ul className="space-y-2">
          <li className="text-[12px] text-amber-700 font-medium leading-relaxed flex gap-2">
            <span className="text-amber-400">•</span>
            공용 PC 사용 시 반드시 '로그아웃' 버튼을 클릭하여 세션을 종료하세요.
          </li>
          <li className="text-[12px] text-amber-700 font-medium leading-relaxed flex gap-2">
            <span className="text-amber-400">•</span>
            아이디와 비밀번호는 타인과 공유하지 마시고 정기적으로 변경하세요.
          </li>
          <li className="text-[12px] text-amber-700 font-medium leading-relaxed flex gap-2">
            <span className="text-amber-400">•</span>
            가능한 경우 '2단계 인증'을 설정하여 비인가 접근을 원천 차단하세요.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SecurityInfo;
