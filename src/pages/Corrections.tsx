import { TrustPage } from "@/components/TrustPage";

export default function Corrections() {
  return (
    <TrustPage
      title="Corrections Policy"
      description="Learn how to report an inaccurate Talus news brief, game record, patch entry or community item."
      canonicalPath="/corrections"
      intro="Accuracy problems should be easy to report and clear to correct. Talus reviews reports against the original source and the current state of the affected page."
      sections={[
        {
          title: "How to report a problem",
          paragraphs: [
            "Open Account Settings and choose Send Error Report. Include the exact Talus page URL, the statement or field that appears wrong, and a reliable source showing the correction. Do not include passwords, access tokens or other private account information.",
          ],
        },
        {
          title: "What happens next",
          paragraphs: [
            "A valid factual issue may be corrected, removed or sent back through the content pipeline. Broken links, mismatched images, duplicate stories and incorrect game data are handled as content-quality errors.",
            "Community opinions are not changed merely because another reader disagrees, but content that violates the community guidelines may be moderated.",
          ],
        },
        {
          title: "Transparent changes",
          paragraphs: [
            "Talus avoids silently turning a disputed claim into a different claim. Material corrections should preserve a clear updated timestamp or correction note when the change would otherwise mislead a returning reader.",
          ],
        },
      ]}
    />
  );
}
