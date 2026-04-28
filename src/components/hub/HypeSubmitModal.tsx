import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SearchResult } from "@/hooks/useHypeMeter";

interface HypeSubmitModalProps {
  game: SearchResult | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function HypeSubmitModal({ game, isOpen, onClose, onSubmit, isSubmitting }: HypeSubmitModalProps) {
  if (!game) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit game to hype meter</DialogTitle>
          <DialogDescription className="sr-only">Confirm submission of game to the community hype meter.</DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="flex items-center gap-4 bg-secondary/50 p-4 rounded-lg border border-border/50 mb-4">
            <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl" style={{ backgroundColor: game.coverColor }}>
              {game.coverEmoji}
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{game.name}</h4>
              <p className="text-sm text-muted-foreground">{game.releaseDate}</p>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            This game will be added to the community hype meter. You'll be the first to vote for it and earn <strong className="text-primary">+15 XP</strong>.
          </p>
        </div>

        <DialogFooter className="sm:justify-end gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isSubmitting} className="bg-[#534AB7] hover:bg-[#534AB7]/90 text-white gap-2">
            {isSubmitting ? "Submitting..." : "Submit + Hype it 🔥"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
