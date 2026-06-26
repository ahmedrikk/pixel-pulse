import { Share2, Link2, Twitter, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShareReviewButtonProps {
  gameId: string;
  gameName: string;
  starRating: number;
  reviewText?: string | null;
  className?: string;
}

/** Letterboxd-style "share my review" — copy a link to the game's review
 *  page, or post it to X / WhatsApp with the rating and (optional) text. */
export function ShareReviewButton({
  gameId,
  gameName,
  starRating,
  reviewText,
  className,
}: ShareReviewButtonProps) {
  const url = `${window.location.origin}/reviews/${gameId}`;
  const stars = "★".repeat(starRating) + "☆".repeat(Math.max(0, 5 - starRating));
  const text = `I rated ${gameName} ${stars} on LevelUpXP${reviewText ? ` — "${reviewText}"` : ""}`;

  const share = async (type: "copy" | "twitter" | "whatsapp") => {
    if (type === "copy") {
      await navigator.clipboard.writeText(url);
      toast.success("Review link copied");
    } else if (type === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } else if (type === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "text-muted-foreground hover:text-primary transition-colors p-1",
            className
          )}
          title="Share review"
          aria-label="Share review"
          onClick={(e) => e.preventDefault()}
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => share("copy")}>
          <Link2 className="h-4 w-4 mr-2" /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => share("twitter")}>
          <Twitter className="h-4 w-4 mr-2" /> Share on X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => share("whatsapp")}>
          <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
