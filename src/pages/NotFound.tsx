import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Gamepad2, Home, Flame } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <SiteLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Gamepad2 className="h-16 w-16 text-primary opacity-80 mb-6" />
        <h1 className="text-6xl font-black text-gradient mb-2">404</h1>
        <p className="text-xl font-semibold text-foreground mb-1">
          This level doesn't exist
        </p>
        <p className="text-muted-foreground max-w-md">
          The page you're looking for was moved, deleted, or never shipped.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all active:scale-95"
          >
            <Home className="h-4 w-4" />
            Back to the feed
          </Link>
          <Link
            to="/reviews"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-foreground font-semibold text-sm hover:bg-secondary/80 transition-all active:scale-95"
          >
            <Flame className="h-4 w-4 text-primary" />
            Trending games
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
};

export default NotFound;
