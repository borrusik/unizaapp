import type { MessageStructureObject } from "imapflow";

export type MailAttachmentPart = {
  part: string;
  filename: string;
  contentType: string;
  size: number;
};

function filenameFor(node: MessageStructureObject): string {
  return (node.dispositionParameters?.filename || node.parameters?.name || "")
    .replace(/[\0\r\n]/g, "")
    .slice(0, 180);
}

function isAttachmentLeaf(node: MessageStructureObject): boolean {
  const disposition = node.disposition?.toLowerCase();
  const type = node.type.toLowerCase();
  if (disposition === "attachment" || disposition === "inline") return true;
  if (filenameFor(node) || node.id) return true;
  return !["text/plain", "text/html", "text/x-amp-html"].includes(type);
}

function isNamedAttachment(node: MessageStructureObject): boolean {
  const disposition = node.disposition?.toLowerCase();
  return disposition === "attachment" || disposition === "inline" || Boolean(filenameFor(node));
}

export function listMailAttachmentParts(structure?: MessageStructureObject): MailAttachmentPart[] {
  if (!structure) return [];
  const parts: MailAttachmentPart[] = [];

  const visit = (node: MessageStructureObject) => {
    if (node.part && !node.type.toLowerCase().startsWith("multipart/") && isNamedAttachment(node)) {
      parts.push({
        part: node.part,
        filename: filenameFor(node),
        contentType: node.type || "application/octet-stream",
        size: node.size ?? 0,
      });
      return;
    }
    if (node.childNodes?.length) {
      for (const child of node.childNodes) visit(child);
      return;
    }
    if (node.part && isAttachmentLeaf(node)) {
      parts.push({
        part: node.part,
        filename: filenameFor(node),
        contentType: node.type || "application/octet-stream",
        size: node.size ?? 0,
      });
      return;
    }
  };

  visit(structure);
  return parts;
}
