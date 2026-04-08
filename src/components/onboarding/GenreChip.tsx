interface GenreChipProps {
  value: string;
  label: string;
  selected: boolean;
  onToggle: (v: string) => void;
}

export function GenreChip({ value, label, selected, onToggle }: GenreChipProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(value)}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
        selected
          ? 'border-[#534AB7] bg-[#534AB7] text-white'
          : 'border-gray-200 text-gray-700 hover:border-[#534AB7]'
      }`}
    >
      {label}
    </button>
  );
}
