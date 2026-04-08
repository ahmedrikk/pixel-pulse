import { Check } from 'lucide-react';

const STEPS = [
  { n: 1, label: 'Identity',   sub: 'Your name and avatar' },
  { n: 2, label: 'Platforms',  sub: 'Where you game' },
  { n: 3, label: 'Your Games', sub: 'What you play' },
  { n: 4, label: 'All done',   sub: "You're in" },
];

interface DesktopLeftPanelProps { currentStep: 1 | 2 | 3 | 4 }

export function DesktopLeftPanel({ currentStep }: DesktopLeftPanelProps) {
  return (
    <div className="hidden md:flex w-[400px] min-h-screen flex-col bg-[#3C3489] px-10 py-10 flex-shrink-0">
      <div className="text-white font-semibold text-xl tracking-wide mb-2">GAME PULSE</div>
      <div className="inline-flex items-center gap-2 rounded-full bg-[#534AB7] px-3 py-1 text-xs text-purple-200 mb-10 self-start">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-300" />
        Season 1 is live
      </div>

      <nav className="flex flex-col gap-0">
        {STEPS.map((step, i) => {
          const done    = step.n < currentStep;
          const active  = step.n === currentStep;
          const upcoming = step.n > currentStep;

          return (
            <div key={step.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  done    ? 'bg-white text-[#3C3489]' :
                  active  ? 'bg-white text-[#3C3489] ring-2 ring-purple-300' :
                            'border-2 border-white/30 text-white/40'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : step.n}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-0.5 h-10 my-1 rounded-full ${done ? 'bg-white/60' : 'bg-white/20'}`} />
                )}
              </div>
              <div className="pb-10">
                <p className={`text-sm font-semibold leading-none mb-0.5 ${upcoming ? 'text-white/40' : 'text-white'}`}>
                  {step.label}
                </p>
                <p className={`text-xs ${upcoming ? 'text-white/25' : 'text-white/60'}`}>{step.sub}</p>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl bg-white/10 px-4 py-3 text-sm text-purple-200">
        +50 XP awaits on completion
      </div>
    </div>
  );
}
