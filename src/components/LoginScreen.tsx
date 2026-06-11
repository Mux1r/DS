import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { HeartPulse, CloudLightning } from 'lucide-react';

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('登入失敗，請再試一次');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
          <HeartPulse size={32} className="text-white" />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Duty List</h1>
          <p className="text-sm text-slate-500 mt-1">值班病患管理系統</p>
        </div>

        <div className="w-full bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex items-start gap-3">
          <CloudLightning size={16} className="text-indigo-500 mt-0.5 shrink-0" />
          <p className="text-xs text-indigo-700 leading-relaxed">
            登入後資料透過 <span className="font-bold">Firebase</span> 自動雲端同步，可在手機、電腦、平板跨裝置即時存取您的值班記錄。
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 rounded-xl shadow-sm transition-all cursor-pointer font-semibold text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoading ? '登入中...' : '使用 Google 帳號登入'}
        </button>

        {error && (
          <p className="text-xs text-rose-500 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100 w-full text-center">
            {error}
          </p>
        )}

        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          您的資料僅供您本人存取<br />受 Firebase Security Rules 保護
        </p>
      </div>
    </div>
  );
}
