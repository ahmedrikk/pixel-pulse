import { Home, Star, Trophy, BookOpen, Cpu, X } from "lucide-react";
import { CATEGORIES } from "@/data/mockNews";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Star, label: "Reviews", href: "/reviews" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: BookOpen, label: "Guides", href: "/guides" },
  { icon: Cpu, label: "Hardware", href: "/hardware" },
];

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div className="absolute left-0 top-0 h-full w-72 bg-card border-r shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-bold text-lg">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* User Profile */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
              GT
            </div>
            <div>
              <h3 className="font-semibold text-sm">GamerTag_X</h3>
              <p className="text-xs text-muted-foreground">@gamertag</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-2">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-secondary transition-colors"
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </a>
          ))}
        </nav>

        {/* Categories */}
        <div className="p-4 border-t">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Categories
          </h4>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`/category/${cat.id}`}
                onClick={onClose}
                className="px-2 py-1 rounded bg-tag text-tag-foreground text-xs font-medium"
              >
                {cat.label}
              </a>
            ))}
          </div>
        </div>

        {/* Auth Buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-card">
          <div className="space-y-2">
            <Button variant="outline" className="w-full">
              Log In
            </Button>
            <Button className="w-full">Create Account</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
