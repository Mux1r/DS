import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';

export interface TourStep {
  target: string; // 畫面元素上的 data-tour 值
  title: string;
  body: string;
  click?: string; // 進這一步前先按這個（CSS 選擇器），例如打開速記面板
  shown?: string; // 看得到這個就代表已經打開了：不重按、也才需要收回（按鈕多半是切換式，按兩次會關掉）
  undo?: string;  // 離開這一步時按這個，把剛才打開的收回去
}

interface Props {
  steps: TourStep[];
  isDarkMode: boolean;
  onClose: () => void;
}

// 同一個 data-tour 可能有電腦版、手機版兩份，挑畫面上看得到的那個
const visible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find(el => el.getClientRects().length > 0) ?? null;
const findVisible = (target: string) => visible(`[data-tour="${target}"]`);

// 引導教學（照 HMSS 的 Tour）：把目標元素用聚光燈框起來，旁邊放說明卡。找不到目標時說明卡置中。
export default function Tour({ steps, isDarkMode, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];

  // 需要的話先按一下（打開面板／展開卡片），等畫面長出來再找目標、捲到中間、量位置；視窗大小改變時重量。
  // 離開這一步時按 undo 收回去，不然面板會一直開著蓋住下一步。
  useLayoutEffect(() => {
    if (step.click && !(step.shown && visible(step.shown))) visible(step.click)?.click();
    let el: HTMLElement | null = null;
    const measure = () => setRect(el ? el.getBoundingClientRect() : null);
    const timers = [
      window.setTimeout(() => {
        el = findVisible(step.target);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        measure();
      }, step.click ? 120 : 0),
      window.setTimeout(measure, step.click ? 500 : 350), // 等捲動、動畫結束再量一次
    ];
    window.addEventListener('resize', measure);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', measure);
      // 收回要等 React 這一輪更新做完再按：在換步驟的同一輪裡按，關閉面板的更新會被吃掉（實測過）
      const { undo, shown } = step;
      if (undo) window.setTimeout(() => { if (!shown || visible(shown)) visible(undo)?.click(); }, 0);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length, onClose]);

  const pad = 6;
  const last = index === steps.length - 1;
  // 說明卡放在目標下方；下方空間不夠就放上方
  const below = rect ? rect.bottom + 200 < window.innerHeight : true;
  const cardStyle: CSSProperties = rect
    ? {
        left: Math.min(Math.max(12, rect.left), window.innerWidth - 12 - Math.min(340, window.innerWidth - 24)),
        ...(below ? { top: rect.bottom + pad + 10 } : { bottom: window.innerHeight - rect.top + pad + 10 }),
      }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        (() => {
          // 聚光燈：用上下左右四塊暗色蓋住目標以外的地方（刻意不用超大陰影，瀏覽器可能不畫）
          const l = rect.left - pad, t = rect.top - pad, w = rect.width + pad * 2, h = rect.height + pad * 2;
          const shade = 'absolute bg-black/60';
          return (
            <>
              <div className={shade} style={{ left: 0, right: 0, top: 0, height: Math.max(0, t) }} />
              <div className={shade} style={{ left: 0, right: 0, top: t + h, bottom: 0 }} />
              <div className={shade} style={{ left: 0, width: Math.max(0, l), top: t, height: h }} />
              <div className={shade} style={{ left: l + w, right: 0, top: t, height: h }} />
              <div
                className="absolute rounded-xl outline-2 outline-[#af9c80] pointer-events-none transition-all duration-200"
                style={{ left: l, top: t, width: w, height: h, outlineStyle: 'solid' }}
              />
            </>
          );
        })()
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}
      <div
        className={`absolute w-[min(340px,calc(100vw-24px))] rounded-2xl border shadow-2xl p-4 space-y-3 animate-scale-up ${
          isDarkMode ? 'bg-[#2c2c27] border-white/10 text-[#eaeade]' : 'bg-[#fafaf9] border-[#e8e8e3] text-[#33332d]'
        }`}
        style={cardStyle}
      >
        <div>
          <p className="text-[11px] font-bold opacity-60">
            {index + 1} / {steps.length}
          </p>
          <h3 id="tour-title" className="text-base font-bold mt-0.5">{step.title}</h3>
          <p className="text-sm leading-relaxed mt-1 opacity-80">{step.body}</p>
        </div>
        {/* 字級寫在外層：index.css 對 button 設了 font-size: inherit */}
        <div className="flex items-center gap-2 text-xs font-bold">
          <button type="button" onClick={onClose} className="mr-auto opacity-60 hover:opacity-100 cursor-pointer">
            結束
          </button>
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              className={`px-3 h-9 rounded-xl border cursor-pointer ${isDarkMode ? 'border-white/10' : 'border-[#dadad4]'}`}
            >
              上一步
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => (last ? onClose() : setIndex(index + 1))}
            className="px-4 h-9 rounded-xl bg-[#60788c] text-white cursor-pointer hover:brightness-110"
          >
            {last ? '完成' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}
