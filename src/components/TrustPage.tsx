import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useDocumentMetadata } from "@/hooks/useDocumentMetadata";

interface TrustSection {
  title: string;
  paragraphs: string[];
}

interface TrustPageProps {
  title: string;
  description: string;
  canonicalPath: string;
  intro: string;
  sections: TrustSection[];
}

export function TrustPage({ title, description, canonicalPath, intro, sections }: TrustPageProps) {
  useDocumentMetadata({ title: `${title} | Talus`, description, canonicalPath });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-3xl py-8 sm:py-12">
        <article className="rounded-2xl border bg-card p-5 card-shadow sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-4 text-body leading-7 text-muted-foreground">{intro}</p>
          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <div className="mt-3 space-y-3 text-body leading-7 text-muted-foreground">
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
      <BottomNavBar />
      <Footer />
    </div>
  );
}
