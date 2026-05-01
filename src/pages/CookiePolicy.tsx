import { Navbar } from "@/components/Navbar";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8 max-w-3xl">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-3xl font-bold tracking-tight mb-6">Cookie Policy</h1>
            <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
              <div className="space-y-6 text-foreground">
                <section>
                  <h2 className="text-xl font-semibold mb-2">1. What Are Cookies</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Cookies are small text files stored on your device when you visit Pixel Pulse.
                    They help us recognize your browser, remember preferences, and understand how
                    you interact with our platform to deliver a better gaming experience.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">2. Types of Cookies We Use</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Essential cookies are required for authentication, security, and core platform
                    functionality. Preference cookies remember your theme, language, and display
                    settings. Analytics cookies help us understand traffic patterns and improve
                    features. Marketing cookies are used sparingly for relevant game promotions.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">3. Third-Party Cookies</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We integrate with gaming platforms and social networks that may set their own
                    cookies. These third parties include Steam, Discord, and analytics providers.
                    Their use of cookies is governed by their respective privacy policies.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">4. Managing Cookies</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    You can control cookies through your browser settings. Most browsers allow you
                    to block or delete cookies. Note that disabling essential cookies may prevent
                    login and other core features from functioning correctly.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">5. Data Handling</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Cookie data is processed in accordance with our Privacy Policy. We do not use
                    cookies to collect sensitive personal information. Aggregated analytics data
                    is anonymized where possible and retained only as long as necessary for
                    operational improvement.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">6. Updates to This Policy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We may update this Cookie Policy to reflect changes in technology or regulation.
                    Significant changes will be communicated through platform notices. The effective
                    date at the top of this policy indicates the latest revision.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-2">7. Contact Us</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have questions about our use of cookies, please reach out through our
                    support channels. We are committed to transparency in how we use tracking
                    technologies to enhance your Pixel Pulse experience.
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
