import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { X, Loader2, Send, Check } from 'lucide-react';
import { db } from '../firebase';
import { version } from '@/package.json';

interface Props {
  user?: User | null;
  isDarkMode: boolean;
  onClose: () => void;
}

const MAX_LEN = 2000;

// 意見回報（照 HMSS 的 Feedback）：存進 Firestore 的 feedback 集合，只能新增、不能讀，要到 Firebase 主控台看。
// 刻意先不收截圖：Firebase Storage 還沒開，需要再加。
export default function Feedback({ user, isDarkMode, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const text = message.trim();
    if (!text) return setError('請先寫一下發生了什麼事');
    if (!user) return setError('要先登入才能送出');
    setSending(true);
    setError('');
    try {
      await addDoc(collection(db, 'feedback'), {
        uid: user.uid,
        email: user.email || null,
        message: text.slice(0, MAX_LEN),
        appVersion: version,
        userAgent: navigator.userAgent.slice(0, 300),
        createdAt: serverTimestamp(),
      });
      // 成功才清空；失敗時保留內容，讓使用者可以直接重送
      setMessage('');
      setSent(true);
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setError(e?.code === 'permission-denied'
        ? '送出失敗：資料庫還沒開放回報（權限不足），內容先留著，晚點再試'
        : '送出失敗，請確認網路後再試，內容先留著');
    } finally {
      setSending(false);
    }
  };

  const panel = isDarkMode ? 'bg-[#2c2c27] border-white/10 text-[#eaeade]' : 'bg-[#fafaf9] border-[#e8e8e3] text-[#33332d]';
  return (
    <div className="fixed inset-0 z-[180] flex items-start justify-center px-4 pt-[calc(env(safe-area-inset-top)+8vh)]" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative w-full max-w-md max-h-[84vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-scale-up ${panel}`}>
        <div className="p-5 border-b border-inherit flex items-center justify-between shrink-0">
          <div>
            <h3 id="feedback-title" className="text-sm font-bold">意見回報</h3>
            <p className="text-[11px] mt-0.5 opacity-60">遇到錯誤或有建議都可以寫在這裡</p>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉" className="p-1.5 rounded-full opacity-60 hover:opacity-100 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto text-xs">
          <label className="block space-y-1.5">
            <span className="font-bold">發生了什麼事？</span>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, MAX_LEN))}
              rows={6}
              autoFocus
              placeholder="例如：交班分頁按「新增」之後，視窗沒有跳出來。"
              className="w-full rounded-xl border border-inherit p-3 text-sm leading-relaxed resize-none outline-none focus:ring-2 focus:ring-[#60788c]/40 bg-transparent"
            />
            <span className="block text-right text-[10px] opacity-50">{message.length}/{MAX_LEN}</span>
          </label>
          {error && <p role="alert" className="text-rose-600 font-medium">{error}</p>}
          <p className="text-[10px] leading-relaxed opacity-60">
            會一起送出目前的版本號和瀏覽器類型，方便找問題{user?.email ? `；也會附上 ${user.email} 方便回覆` : ''}。請不要寫病人的姓名或病歷號。
          </p>
        </div>

        <div className="p-4 border-t border-inherit flex justify-end shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={submit}
            disabled={sending || sent}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white disabled:opacity-80 cursor-pointer ${sent ? 'bg-[#5f7f6d]' : 'bg-[#60788c] hover:brightness-110'}`}
          >
            {sent ? <Check size={14} /> : sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sent ? '已送出，謝謝' : sending ? '送出中…' : '送出'}
          </button>
        </div>
      </div>
    </div>
  );
}
