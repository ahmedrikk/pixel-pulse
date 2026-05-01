import { Navbar } from "@/components/Navbar";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8 max-w-3xl">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-3xl font-bold tracking-tight mb-6">Terms of Service</h1>
            <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
              <div className="space-y-6 text-foreground">
                <section>
                  <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    By accessing or using Pixel Pulse, you agree to be bound by these Terms of Service.
                    If you do not agree to all terms, you may not use our platform. We reserve the
                    right to update these terms at any time, and continued use constitutes acceptance
                    of changes.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">2. User Conduct</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    You agree not to engage in harassment, hate speech, cheating, or distribution of
                    malicious software. Users must not impersonate others, exploit bugs for unfair
                    advantage, or interfere with the platform's infrastructure. Violations may result
                    in immediate suspension or permanent ban.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">3. Intellectual Property</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    All content, trademarks, and data on Pixel Pulse are the property of their
                    respective owners. Users retain ownership of content they submit but grant us a
                    worldwide, royalty-free license to display and distribute it on the platform.
                    Game titles, artwork, and logos belong to their publishers and developers.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">4. DMCA & Copyright</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We respect intellectual property rights. If you believe content on Pixel Pulse
                    infringes your copyright, please submit a DMCA notice with sufficient detail
                    including identification of the work, infringing material, and your contact
                    information. We will investigate and remove infringing content promptly.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">5. Account Termination</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We reserve the right to suspend or terminate accounts for violations of these
                    terms, fraudulent activity, or prolonged inactivity. Upon termination, your right
                    to use the platform ceases immediately. Certain provisions, including intellectual
                    property and liability limitations, survive termination.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">6. Limitation of Liability</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Pixel Pulse is provided "as is" without warranties of any kind. We are not liable
                    for indirect, incidental, or consequential damages arising from platform use.
                    Our total liability shall not exceed the amount you paid us in the twelve months
                    preceding the claim.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">7. Governing Law</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    These terms are governed by the laws of the State of California, without regard
                    to conflict of law principles. Any disputes shall be resolved through binding
                    arbitration in San Francisco, California.
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
