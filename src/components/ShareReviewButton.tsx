import { useState } from "react";
import { Share2, Link2, Twitter, MessageSquare, Instagram, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateReviewStoryCard } from "@/lib/storyCard";

interface ShareReviewButtonProps {
  gameId: string;
  gameName: string;
  starRating: number;
  reviewText?: string | null;
  coverUrl?: string | null;
  userName?: string;
  className?: string;
}

/** Letterboxd-style "share my review" — copy a link to the game's review
 *  page, or post it to X / WhatsApp with the rating and (optional) text. */
export function ShareReviewButton({
  gameId,
  gameName,
  starRating,
  reviewText,
  coverUrl,
  userName,
  className,
}: ShareReviewButtonProps) {
  const [busy, setBusy] = useState(false);
  const url = `${window.location.origin}/reviews/${gameId}`;
  const stars = "★".repeat(starRating) + "☆".repeat(Math.max(0, 5 - starRating));
  const text = `I rated ${gameName} ${stars} on LevelUpXP${reviewText ? ` — "${reviewText}"` : ""}`;

  const shareStory = async () => {
    setBusy(true);
    try {
      const blob = await generateReviewStoryCard({ coverUrl, gameName, starRating, reviewText, userName });
      if (!blob) {
        toast.error("Couldn't generate the story card");
        return;
      }
      const file = new File([blob], `${gameName.replace(/[^a-z0-9]+/gi, "-")}-review.png`, { type: "image/png" });
      // Native share with the image (mobile → Instagram Stories shows up here)
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${gameName} review` });
          return;
        } catch {
          /* user cancelled — fall through to download */
        }
      }
      // Desktop / no file-share: download the PNG to post manually
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(objUrl);
      toast.success("Story image saved — post it to your Instagram story");
    } finally {
      setBusy(false);
    }
  };

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
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={shareStory}>
          <Instagram className="h-4 w-4 mr-2" /> Instagram story
        </DropdownMenuItem>
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
