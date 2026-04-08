interface PlatformCardProps {
  id: string;
  label: string;
  icon: string;
  color: string;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function PlatformCard({ id, label, icon, color, selected, onToggle }: PlatformCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
        selected
          ? 'border-[#534AB7] bg-purple-50'
          : 'border-gray-200 hover:border-purple-300 bg-white'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span className={`text-xs font-medium ${selected ? 'text-[#534AB7]' : 'text-gray-700'}`}>
        {label}
      </span>
    </button>
  );
}
