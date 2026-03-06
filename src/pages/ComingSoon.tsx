import { useParams, useLocation } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { Cpu, BookOpen, Clock } from "lucide-react";

const PAGE_CONFIG: Record<string, { icon: React.ReactNode; title: string; description: string; color: string }> = {
  hardware: {
    icon: <Cpu className="h-16 w-16" />,
    title: "Hardware",
    description: "GPU benchmarks, peripheral reviews, build guides, and tech deals — all in one place.",
    color: "text-blue-500",
  },
  guides: {
    icon: <BookOpen className="h-16 w-16" />,
    title: "Guides",
    description: "Pro tips, walkthroughs, tier lists, and strategy guides for your favourite games.",
    color: "text-purple-500",
  },
};

export default function ComingSoon() {
  const location = useLocation();
  const slug = location.pathname.split("/").filter(Boolean).pop() ?? "";
  const page = PAGE_CONFIG[slug] ?? {
    icon: <Clock className="h-16 w-16" />,
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
    description: "Something awesome is on the way.",
    color: "text-primary",
  };

  return (
    <SiteLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className={`mb-6 ${page.color} opacity-80`}>{page.icon}</div>
        <h1 className="text-4xl font-black mb-2">
          {page.title} <span className="text-primary">Coming Soon</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mt-3">{page.description}</p>
        <div className="mt-8 flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-muted-foreground text-sm font-medium">
          <Clock className="h-4 w-4" />
          In development — stay tuned
        </div>
      </div>
    </SiteLayout>
  );
}
