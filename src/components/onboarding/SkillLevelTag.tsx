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
          ? 'border-[#534AB7] bg-[#534AB7] text-white'
          : 'border-gray-200 text-gray-700 hover:border-[#534AB7]'
      }`}
      title={description}
    >
      {label}
    </button>
  );
}
