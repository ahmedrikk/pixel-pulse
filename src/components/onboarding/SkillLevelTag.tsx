interface SkillLevelTagProps {
  value: string;
  label: string;
  description: string;
  selected: boolean;
  onSelect: (v: string) => void;
}

export function SkillLevelTag({ value, label, description, selected, onSelect }: SkillLevelTagProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
        selected
          ? 'border-[#3d59e0] bg-[#3d59e0] text-white'
          : 'border-gray-200 text-gray-700 hover:border-[#3d59e0]'
      }`}
      title={description}
    >
      {label}
    </button>
  );
}
