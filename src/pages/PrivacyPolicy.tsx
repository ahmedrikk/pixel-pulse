import { Navbar } from "@/components/Navbar";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8 max-w-3xl">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-3xl font-bold tracking-tight mb-6">Privacy Policy</h1>
            <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
              <div className="space-y-6 text-foreground">
                <section>
                  <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We collect account details, gameplay statistics, device information, and usage
                    data to provide and improve Pixel Pulse. This includes your username, email,
                    connected gaming accounts, IP address, and interactions with content on the
                    platform.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">2. How We Use Your Data</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Your data powers personalized feeds, leaderboards, match predictions, and
                    community features. We analyze aggregated patterns to improve recommendation
                    algorithms and detect fraudulent behavior. We do not sell personal information
                    to third parties.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">3. Data Sharing</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We share limited data with service providers for hosting, analytics, and payment
                    processing. Public profiles, usernames, and leaderboard entries are visible to
                    other users. We may disclose data when required by law or to protect our rights.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">4. Cookies & Tracking</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Pixel Pulse uses cookies and similar technologies to remember preferences,
                    maintain sessions, and analyze traffic. You can manage cookie settings through
                    your browser. Disabling cookies may limit certain platform features.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">5. Data Retention</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We retain personal data as long as your account is active or as needed to provide
                    services. Upon account deletion, we remove or anonymize your data within 90 days,
                    except where retention is required for legal obligations or dispute resolution.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">6. Your Rights</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Depending on your jurisdiction, you may have rights to access, correct, delete,
                    or port your data. You may also object to certain processing activities. Contact
                    our privacy team to exercise these rights.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">7. Children's Privacy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Pixel Pulse is not intended for children under 13. We do not knowingly collect
                    data from children. If you believe we have collected data from a child under 13,
                    please contact us immediately so we can delete it.
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
