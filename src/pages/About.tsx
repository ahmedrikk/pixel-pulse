import { TrustPage } from "@/components/TrustPage";

export default function About() {
  return (
    <TrustPage
      title="About Talus"
      description="Learn how Talus organizes gaming news, esports, free-game offers, patch histories, release dates and community ratings."
      canonicalPath="/about"
      intro="Talus is a gaming discovery platform built to make a busy news cycle easier to follow. It brings concise news briefs, esports information, free-game offers, patch histories, release dates and community ratings into one place."
      sections={[
        {
          title: "What Talus publishes",
          paragraphs: [
            "News cards are concise summaries of reporting published by the linked source. Every card keeps a direct link to the original article so readers can check the full context and support the publisher.",
            "Game pages combine structured information from established game-data providers with community reviews submitted on Talus. Patch and offer pages identify their underlying source wherever that information is available.",
          ],
        },
        {
          title: "How the site works",
          paragraphs: [
            "Automated systems collect, deduplicate and organize eligible public gaming stories. Writing rules shorten that material into plain-language briefs without changing the central facts. Talus does not claim ownership of reporting from other publications.",
            "Feed ranking considers recency, reader interest and whether an item has already been shown. It does not change the facts or the destination of the original story.",
          ],
        },
        {
          title: "Accountability",
          paragraphs: [
            "Talus maintains public editorial standards and a corrections process. Readers can report a problem through the Send Error Report option in Account Settings. Reports should include the page URL and a short description of the issue.",
          ],
        },
      ]}
    />
  );
}
