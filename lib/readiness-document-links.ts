type EvidenceDocument = {
  waiver_id: string;
  signer_name: string;
  signed_pdf_url: string | null;
  document_source: string;
  waiver_is_adult: boolean | null;
  signer_category: string | null;
};

type OwnedDocument = { id: string; signer_full_name: string };

function externalDocumentUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function mergeReadinessDocuments(evidence: EvidenceDocument[], owned: OwnedDocument[]) {
  // The evidence view already includes Epic signatures. Match document IDs,
  // never names: different guests or distinct signed documents must survive.
  const ownedIds = new Set(owned.map((document) => document.id));
  const seen = new Set<string>();
  const documents = evidence.flatMap((document) => {
    const isEpic = document.document_source === "epic";
    if (isEpic && ownedIds.has(document.waiver_id)) return [];
    const key = `${document.document_source}:${document.waiver_id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      name: document.signer_name,
      document_url: isEpic
        ? `/api/team/waivers/${encodeURIComponent(document.waiver_id)}/pdf`
        : externalDocumentUrl(document.signed_pdf_url),
      is_minor_or_child: document.waiver_is_adult === null
        ? document.signer_category === "minor" : !document.waiver_is_adult,
      is_waiver_adult: document.waiver_is_adult,
    }];
  });
  for (const document of owned) {
    const key = `epic:${document.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    documents.push({
      name: document.signer_full_name,
      document_url: `/api/team/waivers/${encodeURIComponent(document.id)}/pdf`,
      is_minor_or_child: false,
      is_waiver_adult: true,
    });
  }
  return documents;
}
