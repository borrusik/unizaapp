import sanitizeHtml from "sanitize-html";

type MailInlineAttachment = {
  contentId?: string;
  index: number;
};

export function normalizeMailContentId(value: string | undefined): string {
  return (value ?? "").trim().replace(/^<|>$/g, "").toLowerCase();
}

export function sanitizeMailHtml(
  html: string,
  folder: string,
  uid: number,
  attachments: MailInlineAttachment[],
): string {
  const inlineAttachmentIndexes = new Map(
    attachments.flatMap(({ contentId: rawContentId, index }) => {
      const contentId = normalizeMailContentId(rawContentId);
      return contentId ? [[contentId, index] as const] : [];
    }),
  );
  const transformMailImage: sanitizeHtml.Transformer = (_tagName, attributes) => {
    const source = attributes.src?.trim() ?? "";
    const contentId = source.toLowerCase().startsWith("cid:")
      ? normalizeMailContentId(source.slice(4))
      : "";
    const attachmentIndex = contentId ? inlineAttachmentIndexes.get(contentId) : undefined;
    const safeSource = attachmentIndex !== undefined
      ? `/api/mail/attachment?folder=${encodeURIComponent(folder)}&uid=${uid}&index=${attachmentIndex}&disposition=inline`
      : /^https:\/\//i.test(source) ? source : "";
    if (!safeSource) return { tagName: "span", attribs: {} as sanitizeHtml.Attributes };
    return {
      tagName: "img",
      attribs: {
        src: safeSource,
        alt: (attributes.alt || "").slice(0, 300),
        title: (attributes.title || "").slice(0, 300),
        loading: "lazy",
        decoding: "async",
        referrerpolicy: "no-referrer",
      },
    };
  };

  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "referrerpolicy"],
      table: ["cellpadding", "cellspacing"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
      img: transformMailImage,
    },
  });
}
