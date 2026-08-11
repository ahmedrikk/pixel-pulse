import { Navbar } from "./Navbar";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";

interface SiteLayoutProps {
  children: React.ReactNode;
}

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
      <div className="min-h-screen">
        <div className="talus-shell">
            {/* Left Sidebar */}
            <div className="sticky top-4 hidden max-h-[calc(100vh-2rem)] min-w-0 self-start overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border lg:block">
              <LeftSidebar />
            </div>

            {/* Main Content */}
            <div className="talus-main-column">
              <Navbar />
              <div className="px-3 py-3 sm:px-4 sm:py-4">
                {children}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="sticky top-4 hidden max-h-[calc(100vh-2rem)] min-w-0 self-start overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border xl:block">
              <RightSidebar />
            </div>
        </div>
      </div>
  );
}
