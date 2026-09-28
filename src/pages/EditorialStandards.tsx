import { TrustPage } from "@/components/TrustPage";

export default function EditorialStandards() {
  return (
    <TrustPage
      title="Editorial Standards"
      description="Read the sourcing, summarization, attribution and quality standards used for content published on Talus."
      canonicalPath="/editorial-standards"
      intro="These standards explain how Talus selects, summarizes and presents material from gaming publications, video channels and structured data providers."
      sections={[
        {
          title: "Source and attribution",
          paragraphs: [
            "A news brief must link to the original page and identify its publication. Summaries should stand on the facts in that source, not add unsupported claims, quotes or certainty.",
            "When a source writes in the first person, the summary replaces I, we or our with the publication name. Otherwise, the brief states the information directly instead of repeatedly announcing that a publication reported it.",
          ],
        },
        {
          title: "Headlines and summaries",
          paragraphs: [
            "Headlines may be rewritten for clarity and readability while remaining close to the meaning of the source headline. They must not manufacture urgency, exclusivity or conclusions that the source does not support.",
            "Summaries aim to give readers the central development, the relevant context and the practical consequence in concise, natural language. Promotional filler, invented quotations and unsupported speculation are not allowed.",
          ],
        },
        {
          title: "Automation and review",
          paragraphs: [
            "Talus uses automated collection and language tools to process a large number of public updates. Automated output remains subject to sourcing rules, duplicate checks, formatting checks and reader correction reports.",
            "A linked source remains the authoritative version of an aggregated story. Talus community reviews are separately labeled and reflect the individual contributor's opinion.",
          ],
        },
        {
          title: "Images",
          paragraphs: [
            "News images should come from the source page's published metadata or an authorized platform thumbnail. Missing images are not replaced with an unrelated picture presented as if it came from the story.",
          ],
        },
      ]}
    />
  );
}
