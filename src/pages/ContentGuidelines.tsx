import { Navbar } from "@/components/Navbar";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ContentGuidelines() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8 max-w-3xl">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-3xl font-bold tracking-tight mb-6">Content Guidelines</h1>
            <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
              <div className="space-y-6 text-foreground">
                <section>
                  <h2 className="text-xl font-semibold mb-2">1. Our Commitment</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Pixel Pulse is a community built by gamers, for gamers. These guidelines ensure
                    our platform remains welcoming, informative, and safe. By participating, you
                    agree to uphold these standards in every comment, review, prediction, and post.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">2. Respectful Conduct</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Treat fellow community members with respect. Discrimination, harassment,
                    doxxing, and targeted abuse are strictly prohibited. Debate game mechanics
                    and opinions vigorously, but never attack individuals. Toxic behavior undermines
                    the experience for everyone.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">3. Intellectual Property</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Only share content you have the right to distribute. Do not post leaked
                    materials, proprietary source code, or pirated content. When sharing news,
                    credit original sources. Fan art and transformative content are encouraged
                    within fair-use boundaries.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">4. DMCA & Takedowns</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We respond to valid copyright complaints under the DMCA. If your content is
                    removed due to a claim, you may submit a counter-notification. Repeated
                    infringement will result in account termination. Frivolous or fraudulent
                    claims may lead to legal consequences.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">5. Spoilers & Sensitive Content</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Use spoiler tags when discussing plot details, endings, or unreleased content.
                    Clearly label mature or graphic content. Excessive gore, explicit sexual
                    content, and gratuitous violence are not permitted outside appropriately
                    marked contexts.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">6. Enforcement & Appeals</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Moderators may remove content, issue warnings, or suspend accounts for
                    guideline violations. Automated systems assist in detecting spam and abuse.
                    If you believe a moderation decision was incorrect, you may appeal through
                    our support portal within 30 days.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">7. Limitation of Liability</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Pixel Pulse does not endorse user-generated content and is not liable for
                    opinions expressed by community members. We act in good faith to moderate
                    but cannot guarantee real-time oversight of all interactions. Report
                    violations to help us maintain quality.
                  </p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>

      <BottomNavBar />
      <Footer />
    </div>
  );
}
