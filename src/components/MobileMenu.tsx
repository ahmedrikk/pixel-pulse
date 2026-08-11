import { useRef, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Content Guidelines", href: "/guidelines" },
];

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const touchStartX = useRef<number | null>(null);

  const closeAfterLink = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a")) onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        id="mobile-navigation-drawer"
        side="left"
        aria-describedby={undefined}
        className="w-[min(88vw,22rem)] overflow-y-auto p-0 md:hidden"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const startX = touchStartX.current;
          const endX = event.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (startX !== null && endX !== undefined && endX - startX < -64) onClose();
        }}
      >
        <SheetHeader className="sticky top-0 z-20 border-b bg-background/95 px-4 py-4 text-left backdrop-blur-md">
          <SheetTitle className="text-card-title">Menu</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-4 pb-8" onClickCapture={closeAfterLink}>
          <section aria-label="Account and navigation">
            <LeftSidebar />
          </section>

          <section aria-label="Talus widgets">
            <RightSidebar />
          </section>

          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-4">
            {LEGAL_LINKS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="text-tiny-label text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
