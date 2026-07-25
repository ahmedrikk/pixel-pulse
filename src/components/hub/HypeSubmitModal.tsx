import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SearchResult } from "@/hooks/useHypeMeter";
import { GameArtwork } from "@/components/shared/GameArtwork";

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
            <GameArtwork name={game.name} src={game.coverUrl} className="h-12 w-12" />
            <div>
              <h4 className="font-semibold text-foreground">{game.name}</h4>
              <p className="text-sm text-muted-foreground">{game.releaseDate}</p>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            This game will be added to the community hype meter, and you&apos;ll be the first to vote for it.
          </p>
        </div>

        <DialogFooter className="sm:justify-end gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            {isSubmitting ? "Submitting..." : "Submit + Hype it 🔥"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
