interface GameRowProps {
  id: string;
  name: string;
  genre: string;
  coverUrl: string;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function GameRow({ id, name, genre, coverUrl, selected, onToggle }: GameRowProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
        selected ? 'bg-purple-50 border border-[#534AB7]' : 'border border-transparent hover:bg-gray-50'
      }`}
    >
      <img
        src={coverUrl}
        alt={name}
        className="w-7 h-7 rounded object-cover flex-shrink-0"
        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=28&h=28&fit=crop'; }}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${selected ? 'text-[#534AB7]' : 'text-gray-900'}`}>{name}</p>
        <p className="text-xs text-gray-500">{genre}</p>
      </div>
      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
        selected ? 'bg-[#534AB7] border-[#534AB7]' : 'border-gray-300'
      }`}>
        {selected && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5l-1 1 4 4 6-7z"/></svg>}
      </div>
    </button>
  );
}
