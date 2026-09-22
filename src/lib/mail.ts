"use server";

import { ImapFlow, type MessageAddressObject, type MessageStructureObject } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { readCredentials } from "@/lib/credentials";
import { sanitizeMailHtml } from "@/lib/mail-content";
import { rateLimit } from "@/lib/rate-limit";

const MAIL_HOST = "mail.stud.uniza.sk";
const IMAP_PORT = 993;
const SMTP_PORT = 465;
const MAIL_TIMEOUT_MS = 20_000;
const PAGE_SIZE = 30;
const MAX_SEARCH_LENGTH = 120;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 4 * 1024 * 1024;

export type MailFolder = {
  path: string;
  name: string;
  specialUse: string | null;
  messages: number;
  unseen: number;
};

export type MailAddress = {
  name: string;
  address: string;
};

export type MailSummary = {
  uid: number;
  subject: string;
  from: MailAddress[];
  date: string | null;
  preview: string;
  unread: boolean;
  flagged: boolean;
  hasAttachments: boolean;
};

export type MailAttachment = {
  index: number;
  filename: string;
  contentType: string;
  size: number;
};

export type MailDetail = MailSummary & {
  to: MailAddress[];
  cc: MailAddress[];
  text: string;
  html: string;
  attachments: MailAttachment[];
};

export type MailboxPage = {
  folders: MailFolder[];
  folder: string;
  messages: MailSummary[];
  selectedMessage: MailDetail | null;
  total: number;
  page: number;
  hasMore: boolean;
};

function normalizeAddresses(addresses?: MessageAddressObject[]): MailAddress[] {
  return (addresses ?? [])
    .map((item) => ({
      name: (item.name ?? "").trim().slice(0, 160),
      address: (item.address ?? "").trim().toLowerCase().slice(0, 254),
    }))
    .filter((item) => item.address);
}

function cleanPreview(value: string | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function toIso(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hasAttachment(structure?: MessageStructureObject): boolean {
  if (!structure) return false;
  if (structure.disposition?.toLowerCase() === "attachment") return true;
  return (structure.childNodes ?? []).some(hasAttachment);
}

function validateMailboxPath(value: string): string {
  const path = value.trim();
  if (!path || path.length > 255 || /[\0\r\n]/.test(path)) {
    throw new Error("Invalid mailbox");
  }
  return path;
}

function validateUid(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid message");
  return value;
}

function validateStudentEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@stud\.uniza\.sk$/.test(email)) {
    throw new Error("Mail is available only for @stud.uniza.sk accounts");
  }
  return email;
}

function validateRecipientList(value: string, required = false): string[] {
  const items = value
    .split(/[;,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if ((required && items.length === 0) || items.length > 30) {
    throw new Error("Invalid recipients");
  }
  for (const email of items) {
    if (email.length > 254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)) {
      throw new Error("Invalid recipient address");
    }
  }
  return items;
}

function createImapClient(email: string, password: string): ImapFlow {
  return new ImapFlow({
    host: MAIL_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
  });
}

async function withMailClient<T>(
  callback: (client: ImapFlow, email: string) => Promise<T>,
): Promise<T> {
  const credentials = await readCredentials();
  if (!credentials) throw new Error("MAIL_RECONNECT_REQUIRED");
  const email = validateStudentEmail(credentials.email);
  const client = createImapClient(email, credentials.password);
  await client.connect();
  try {
    return await callback(client, email);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

async function listFolders(client: ImapFlow): Promise<MailFolder[]> {
  const folders = await client.list({
    statusQuery: { messages: true, unseen: true },
  });
  return folders
    .filter((folder) => !folder.flags.has("\\Noselect"))
    .map((folder) => ({
      path: folder.path,
      name: folder.name || folder.path,
      specialUse: folder.specialUse ?? (folder.path.toUpperCase() === "INBOX" ? "\\Inbox" : null),
      messages: folder.status?.messages ?? 0,
      unseen: folder.status?.unseen ?? 0,
    }))
    .toSorted((left, right) => {
      const order = ["\\Inbox", "\\Sent", "\\Drafts", "\\Archive", "\\Junk", "\\Trash"];
      const leftIndex = order.indexOf(left.specialUse ?? "");
      const rightIndex = order.indexOf(right.specialUse ?? "");
      if (leftIndex !== rightIndex) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }
      return left.name.localeCompare(right.name);
    });
}

async function requireExistingFolder(client: ImapFlow, path: string): Promise<string> {
  const validated = validateMailboxPath(path);
  const folders = await client.list({ listOnly: true });
  const match = folders.find((folder) => folder.path === validated && !folder.flags.has("\\Noselect"));
  if (!match) throw new Error("Mailbox not found");
  return match.path;
}

async function readMailDetail(client: ImapFlow, folder: string, uid: number, markSeen = true): Promise<MailDetail> {
  const safeUid = validateUid(uid);
  const message = await client.fetchOne(
    safeUid,
    {
      uid: true,
      flags: true,
      envelope: true,
      internalDate: true,
      size: true,
      bodyStructure: true,
      source: { maxLength: MAX_SOURCE_BYTES },
    },
    { uid: true },
  );
  if (!message || !message.source) throw new Error("Message not found or too large");
  if (message.size && message.size > MAX_SOURCE_BYTES) throw new Error("Message is too large to display");

  const parsed = await simpleParser(message.source, {
    skipImageLinks: true,
    maxHtmlLengthToParse: 2 * 1024 * 1024,
  });
  const safeHtml = typeof parsed.html === "string"
    ? sanitizeMailHtml(
        parsed.html,
        folder,
        message.uid,
        parsed.attachments.map((attachment, index) => ({ contentId: attachment.contentId, index })),
      )
    : "";

  const unread = !message.flags?.has("\\Seen");
  if (markSeen && unread) await client.messageFlagsAdd(safeUid, ["\\Seen"], { uid: true });
  const from = normalizeAddresses(message.envelope?.from);
  return {
    uid: message.uid,
    subject: parsed.subject?.trim().slice(0, 500) || message.envelope?.subject?.trim().slice(0, 500) || "(no subject)",
    from,
    to: normalizeAddresses(message.envelope?.to),
    cc: normalizeAddresses(message.envelope?.cc),
    date: toIso(parsed.date ?? message.envelope?.date ?? message.internalDate),
    preview: cleanPreview(parsed.text),
    unread: markSeen ? false : unread,
    flagged: Boolean(message.flags?.has("\\Flagged")),
    hasAttachments: parsed.attachments.some((attachment) => !attachment.related),
    text: (parsed.text ?? "").slice(0, 2 * 1024 * 1024),
    html: safeHtml,
    attachments: parsed.attachments
      .map((attachment, index) => ({ attachment, index }))
      .filter(({ attachment }) => !attachment.related)
      .map(({ attachment, index }) => ({
        index,
        filename: (attachment.filename || `attachment-${index + 1}`).replace(/[\0\r\n]/g, "").slice(0, 180),
        contentType: attachment.contentType || "application/octet-stream",
        size: attachment.size,
      })),
  };
}

export async function getMailbox(
  folder = "INBOX",
  page = 1,
  search = "",
): Promise<MailboxPage> {
  return withMailClient(async (client) => {
    const folders = await listFolders(client);
    const selected = folders.some((item) => item.path === folder) ? folder : "INBOX";
    const lock = await client.getMailboxLock(selected);
    try {
      const normalizedPage = Math.max(1, Math.min(1000, Math.trunc(page) || 1));
      const normalizedSearch = search.replace(/[\0\r\n]/g, " ").trim().slice(0, MAX_SEARCH_LENGTH);
      const found = normalizedSearch
        ? await client.search({ text: normalizedSearch }, { uid: true })
        : await client.search({ all: true }, { uid: true });
      const allUids = Array.isArray(found) ? found.toSorted((a, b) => b - a) : [];
      const start = (normalizedPage - 1) * PAGE_SIZE;
      const pageUids = allUids.slice(start, start + PAGE_SIZE);
      if (pageUids.length === 0) {
        return {
          folders,
          folder: selected,
          messages: [],
          selectedMessage: null,
          total: allUids.length,
          page: normalizedPage,
          hasMore: false,
        };
      }

      const fetched = await client.fetchAll(
        pageUids,
        { uid: true, flags: true, envelope: true, internalDate: true, bodyStructure: true },
        { uid: true },
      );
      const byUid = new Map(fetched.map((message) => [message.uid, message]));
      const messages = pageUids.flatMap((uid) => {
        const message = byUid.get(uid);
        if (!message) return [];
        const from = normalizeAddresses(message.envelope?.from);
        return [{
          uid: message.uid,
          subject: message.envelope?.subject?.trim().slice(0, 500) || "(no subject)",
          from,
          date: toIso(message.envelope?.date ?? message.internalDate),
          preview: "",
          unread: !message.flags?.has("\\Seen"),
          flagged: Boolean(message.flags?.has("\\Flagged")),
          hasAttachments: hasAttachment(message.bodyStructure),
        } satisfies MailSummary];
      });
      const selectedMessage = await readMailDetail(client, selected, pageUids[0], false).catch(() => null);

      return {
        folders,
        folder: selected,
        messages,
        selectedMessage,
        total: allUids.length,
        page: normalizedPage,
        hasMore: start + pageUids.length < allUids.length,
      };
    } finally {
      lock.release();
    }
  });
}

export async function getMailMessage(folder: string, uid: number): Promise<MailDetail> {
  return withMailClient(async (client) => {
    const selected = await requireExistingFolder(client, folder);
    const safeUid = validateUid(uid);
    const lock = await client.getMailboxLock(selected);
    try {
      return await readMailDetail(client, selected, safeUid);
    } finally {
      lock.release();
    }
  });
}

export async function setMailFlag(
  folder: string,
  uid: number,
  flag: "seen" | "flagged",
  enabled: boolean,
): Promise<{ success: true }> {
  return withMailClient(async (client) => {
    const selected = await requireExistingFolder(client, folder);
    const safeUid = validateUid(uid);
    const imapFlag = flag === "seen" ? "\\Seen" : "\\Flagged";
    const lock = await client.getMailboxLock(selected);
    try {
      if (enabled) await client.messageFlagsAdd(safeUid, [imapFlag], { uid: true });
      else await client.messageFlagsRemove(safeUid, [imapFlag], { uid: true });
      return { success: true };
    } finally {
      lock.release();
    }
  });
}

export async function sendMail(formData: FormData): Promise<{ success: true }> {
  const credentials = await readCredentials();
  if (!credentials) throw new Error("MAIL_RECONNECT_REQUIRED");
  const email = validateStudentEmail(credentials.email);
  const { limited } = rateLimit(`mail_send_${email}`, 10, 10 * 60 * 1000);
  if (limited) throw new Error("Too many messages. Try again later.");

  const to = validateRecipientList(String(formData.get("to") ?? ""), true);
  const cc = validateRecipientList(String(formData.get("cc") ?? ""));
  const bcc = validateRecipientList(String(formData.get("bcc") ?? ""));
  const subject = String(formData.get("subject") ?? "").replace(/[\0\r\n]/g, " ").trim().slice(0, 500);
  const text = String(formData.get("text") ?? "").replace(/\0/g, "").slice(0, 200_000);
  if (!subject && !text.trim()) throw new Error("Message is empty");

  const files = formData.getAll("attachments").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.some((file) => file.size > MAX_ATTACHMENT_BYTES)) throw new Error("An attachment is larger than 3 MB");
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) throw new Error("Attachments are larger than 4 MB in total");
  const attachments = await Promise.all(files.map(async (file) => ({
    filename: file.name.replace(/[\0\r\n]/g, "").slice(0, 180) || "attachment",
    content: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || "application/octet-stream",
  })));

  const transport = nodemailer.createTransport({
    host: MAIL_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: { user: email, pass: credentials.password },
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  await transport.sendMail({
    from: email,
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject,
    text,
    attachments,
  });
  transport.close();
  return { success: true };
}

export async function getMailAttachment(
  folder: string,
  uid: number,
  index: number,
): Promise<{ filename: string; contentType: string; content: string }> {
  if (!Number.isInteger(index) || index < 0 || index > 100) throw new Error("Invalid attachment");
  return withMailClient(async (client) => {
    const selected = await requireExistingFolder(client, folder);
    const safeUid = validateUid(uid);
    const lock = await client.getMailboxLock(selected, { readOnly: true });
    try {
      const message = await client.fetchOne(
        safeUid,
        { source: { maxLength: MAX_SOURCE_BYTES }, size: true },
        { uid: true },
      );
      if (!message || !message.source || (message.size && message.size > MAX_SOURCE_BYTES)) {
        throw new Error("Attachment is unavailable");
      }
      const parsed = await simpleParser(message.source, { skipImageLinks: true });
      const attachment = parsed.attachments[index];
      if (!attachment || attachment.size > MAX_ATTACHMENT_BYTES) throw new Error("Attachment is unavailable");
      return {
        filename: (attachment.filename || `attachment-${index + 1}`).replace(/[\0\r\n]/g, "").slice(0, 180),
        contentType: attachment.contentType || "application/octet-stream",
        content: attachment.content.toString("base64"),
      };
    } finally {
      lock.release();
    }
  });
}
