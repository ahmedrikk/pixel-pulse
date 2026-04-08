interface StepProgressBarProps { currentStep: 1 | 2 | 3 | 4 }

export function StepProgressBar({ currentStep }: StepProgressBarProps) {
  return (
    <div className="flex gap-1.5 w-full">
      {[1, 2, 3, 4].map(n => (
        <div
          key={n}
          className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
            n <= currentStep ? 'bg-[#534AB7]' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}
