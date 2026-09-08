"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { AppIcon } from "@/components/AppIcon";
import { useTranslation, type Lang } from "@/hooks/useTranslation";
import {
  getMailbox,
  getMailMessage,
  setMailFlag,
  type MailAddress,
  type MailFolder,
} from "@/lib/mail";

const COPY = {
  sk: {
    title: "Pošta", compose: "Nová správa", search: "Hľadať v pošte", inbox: "Doručené", sent: "Odoslané",
    drafts: "Koncepty", archive: "Archív", junk: "Spam", trash: "Kôš", folders: "Priečinky",
    empty: "V tomto priečinku nie sú správy", choose: "Vyberte správu", loading: "Načítavam poštu…",
    reconnect: "Pošta potrebuje šifrované prihlásenie. Odhláste sa a prihláste sa znova.",
    from: "Od", to: "Komu", cc: "Kópia", bcc: "Skrytá kópia", subject: "Predmet", message: "Správa",
    send: "Odoslať", sending: "Odosielam…", cancel: "Zrušiť", sentOk: "Správa bola odoslaná",
    sendFailed: "Správu sa nepodarilo odoslať", attachments: "Prílohy", attach: "Priložiť súbory",
    previous: "Novšie", next: "Staršie", results: "správ", unread: "Neprečítané", flagged: "Označené",
  },
  en: {
    title: "Mail", compose: "New message", search: "Search mail", inbox: "Inbox", sent: "Sent",
    drafts: "Drafts", archive: "Archive", junk: "Spam", trash: "Trash", folders: "Folders",
    empty: "There are no messages in this folder", choose: "Select a message", loading: "Loading mail…",
    reconnect: "Mail needs an encrypted sign-in. Sign out and sign in again.",
    from: "From", to: "To", cc: "Cc", bcc: "Bcc", subject: "Subject", message: "Message",
    send: "Send", sending: "Sending…", cancel: "Cancel", sentOk: "Message sent",
    sendFailed: "The message could not be sent", attachments: "Attachments", attach: "Attach files",
    previous: "Newer", next: "Older", results: "messages", unread: "Unread", flagged: "Flagged",
  },
  uk: {
    title: "Пошта", compose: "Новий лист", search: "Пошук у пошті", inbox: "Вхідні", sent: "Надіслані",
    drafts: "Чернетки", archive: "Архів", junk: "Спам", trash: "Кошик", folders: "Папки",
    empty: "У цій папці немає листів", choose: "Виберіть лист", loading: "Завантаження пошти…",
    reconnect: "Для пошти потрібен зашифрований вхід. Вийдіть і увійдіть знову.",
    from: "Від", to: "Кому", cc: "Копія", bcc: "Прихована копія", subject: "Тема", message: "Повідомлення",
    send: "Надіслати", sending: "Надсилання…", cancel: "Скасувати", sentOk: "Лист надіслано",
    sendFailed: "Не вдалося надіслати лист", attachments: "Вкладення", attach: "Додати файли",
    previous: "Новіші", next: "Старіші", results: "листів", unread: "Непрочитані", flagged: "Позначені",
  },
  ru: {
    title: "Почта", compose: "Новое письмо", search: "Поиск по почте", inbox: "Входящие", sent: "Отправленные",
    drafts: "Черновики", archive: "Архив", junk: "Спам", trash: "Корзина", folders: "Папки",
    empty: "В этой папке нет писем", choose: "Выберите письмо", loading: "Загружаю почту…",
    reconnect: "Для почты нужен зашифрованный вход. Выйдите и войдите снова.",
    from: "От", to: "Кому", cc: "Копия", bcc: "Скрытая копия", subject: "Тема", message: "Сообщение",
    send: "Отправить", sending: "Отправляю…", cancel: "Отмена", sentOk: "Письмо отправлено",
    sendFailed: "Не удалось отправить письмо", attachments: "Вложения", attach: "Прикрепить файлы",
    previous: "Новее", next: "Старее", results: "писем", unread: "Непрочитанные", flagged: "Отмеченные",
  },
} as const;

function addressLabel(addresses: MailAddress[]): string {
  return addresses.map((address) => address.name || address.address).join(", ") || "—";
}

function folderLabel(folder: MailFolder, copy: (typeof COPY)[Lang]): string {
  const labels: Record<string, string> = {
    "\\Inbox": copy.inbox,
    "\\Sent": copy.sent,
    "\\Drafts": copy.drafts,
    "\\Archive": copy.archive,
    "\\Junk": copy.junk,
    "\\Trash": copy.trash,
  };
  return labels[folder.specialUse ?? ""] ?? folder.name;
}

function formatDate(value: string | null, lang: Lang): string {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat(
    { sk: "sk-SK", en: "en-GB", uk: "uk-UA", ru: "ru-RU" }[lang],
    { dateStyle: "medium", timeStyle: "short" },
  ).format(date);
}

function MailboxSkeleton() {
  return (
    <>
      <aside className="mail-folders mail-folders-skeleton" aria-hidden="true">
        <div className="mail-folder-title skeleton-line" />
        {[1, 2, 3, 4, 5].map((item) => <div className="mail-folder skeleton" key={item} />)}
      </aside>
      <section className="mail-list-panel" aria-hidden="true">
        <div className="mail-search skeleton" />
        <div className="mail-message-list">
          {[1, 2, 3, 4, 5, 6].map((item) => <div className="mail-message-row skeleton" key={item} />)}
        </div>
      </section>
      <article className="mail-reader mail-reader-skeleton" aria-hidden="true">
        <div className="mail-reader-content">
          <div className="skeleton-line mail-skeleton-title" />
          <div className="skeleton-line mail-skeleton-meta" />
          <div className="skeleton-line mail-skeleton-meta short" />
          <div className="mail-skeleton-body skeleton" />
        </div>
      </article>
    </>
  );
}

export default function MailPage() {
  const { lang } = useTranslation();
  const copy = COPY[lang];
  const [folder, setFolder] = useState("INBOX");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sendState, setSendState] = useState<"idle" | "sent" | "error">("idle");
  const [isSending, startSending] = useTransition();

  const mailboxKey = useMemo(() => ["uniza_mailbox", folder, page, search] as const, [folder, page, search]);
  const { data, error, isLoading, isValidating, mutate } = useSWR(mailboxKey, ([, selectedFolder, selectedPage, selectedSearch]) =>
    getMailbox(selectedFolder, selectedPage, selectedSearch),
    { revalidateOnFocus: false, dedupingInterval: 20_000 },
  );
  const initialDetail = data?.selectedMessage ?? null;
  const shouldFetchSelected = selectedUid !== null && selectedUid !== initialDetail?.uid;
  const { data: fetchedDetail, isLoading: selectedDetailLoading, mutate: mutateDetail } = useSWR(
    shouldFetchSelected ? ["uniza_mail_message", folder, selectedUid] as const : null,
    ([, selectedFolder, uid]) => getMailMessage(selectedFolder, uid),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      onSuccess: (message) => {
        void mutate((current) => current ? {
          ...current,
          messages: current.messages.map((item) => item.uid === message.uid ? { ...item, unread: false } : item),
        } : current, { revalidate: false });
      },
    },
  );
  const detail = selectedUid === null || selectedUid === initialDetail?.uid ? initialDetail : fetchedDetail;
  const activeUid = selectedUid ?? initialDetail?.uid ?? null;
  const detailLoading = shouldFetchSelected && selectedDetailLoading;

  const selectFolder = (path: string) => {
    setFolder(path);
    setPage(1);
    setSelectedUid(null);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSelectedUid(null);
    setSearch(query.trim());
  };

  const selectMessage = (uid: number) => {
    setSelectedUid(uid);
    const summary = data?.messages.find((message) => message.uid === uid);
    if (summary?.unread && initialDetail?.uid === uid) {
      void setMailFlag(folder, uid, "seen", true).then(() => mutate((current) => current ? {
        ...current,
        messages: current.messages.map((message) => message.uid === uid ? { ...message, unread: false } : message),
        selectedMessage: current.selectedMessage?.uid === uid
          ? { ...current.selectedMessage, unread: false }
          : current.selectedMessage,
        folders: current.folders.map((item) => item.path === folder
          ? { ...item, unseen: Math.max(0, item.unseen - 1) }
          : item),
      } : current, { revalidate: false })).catch(() => undefined);
    }
  };

  const toggleFlag = async () => {
    if (!detail) return;
    const flagged = !detail.flagged;
    await setMailFlag(folder, detail.uid, "flagged", flagged);
    const updateMailbox = mutate((current) => current ? {
      ...current,
      messages: current.messages.map((message) => message.uid === detail.uid ? { ...message, flagged } : message),
      selectedMessage: current.selectedMessage?.uid === detail.uid
        ? { ...current.selectedMessage, flagged }
        : current.selectedMessage,
    } : current, { revalidate: false });
    if (shouldFetchSelected) {
      await Promise.all([mutateDetail({ ...detail, flagged }, { revalidate: false }), updateMailbox]);
    } else {
      await updateMailbox;
    }
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    setSendState("idle");
    startSending(async () => {
      try {
        const response = await fetch("/api/mail/send", { method: "POST", body: payload });
        if (!response.ok) throw new Error("Unable to send message");
        form.reset();
        setSendState("sent");
        setComposeOpen(false);
        await mutate();
      } catch {
        setSendState("error");
      }
    });
  };

  return (
    <div className="mail-page-shell">
      <header className="top-bar mail-top-bar">
        <div className="mail-title-block">
          <div className="top-bar-title">{copy.title}</div>
          <span>{data ? `${data.total} ${copy.results}` : copy.loading}</span>
        </div>
        <div className="mail-header-actions">
          <button type="button" className="icon-button" aria-label={copy.loading} disabled={isValidating} onClick={() => mutate()}>
            <AppIcon name="refresh" size={19} className={isValidating ? "spin" : ""} />
          </button>
          <button type="button" className="mail-compose-button" onClick={() => { setComposeOpen(true); setSendState("idle"); }}>
            <AppIcon name="edit" size={18} />
            <span>{copy.compose}</span>
          </button>
        </div>
      </header>

      <div className="mail-layout">
        {isLoading && !data ? <MailboxSkeleton /> : null}
        {error && !data ? <div className="mail-state mail-error mail-layout-error"><AppIcon name="warning" size={28} /><p>{copy.reconnect}</p></div> : null}
        {data ? <aside className="mail-folders" aria-label={copy.folders}>
          <div className="mail-folder-title">{copy.folders}</div>
          {(data?.folders ?? []).map((item) => (
            <button
              type="button"
              key={item.path}
              className={`mail-folder ${folder === item.path ? "active" : ""}`}
              onClick={() => selectFolder(item.path)}
            >
              <AppIcon name={item.specialUse === "\\Trash" ? "trash" : item.specialUse === "\\Sent" ? "send" : "mail"} size={18} />
              <span>{folderLabel(item, copy)}</span>
              {item.unseen > 0 ? <strong>{item.unseen}</strong> : null}
            </button>
          ))}
        </aside> : null}

        {data ? <section className={`mail-list-panel ${activeUid ? "has-selection" : ""}`}>
          <form className="mail-search" onSubmit={submitSearch}>
            <AppIcon name="search" size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder={copy.search} aria-label={copy.search} />
            {query ? <button type="button" aria-label={copy.cancel} onClick={() => { setQuery(""); setSearch(""); setPage(1); }}><AppIcon name="x" size={16} /></button> : null}
          </form>

          {error ? <div className="mail-state mail-error"><AppIcon name="warning" size={28} /><p>{copy.reconnect}</p></div> : null}
          {!error && data.messages.length === 0 ? <div className="mail-state"><AppIcon name="mail" size={32} /><p>{copy.empty}</p></div> : null}

          <div className="mail-message-list">
            {data.messages.map((message) => (
              <button
                type="button"
                key={message.uid}
                className={`mail-message-row ${message.unread ? "unread" : ""} ${activeUid === message.uid ? "active" : ""}`}
                onClick={() => selectMessage(message.uid)}
              >
                <span className="mail-unread-dot" aria-label={message.unread ? copy.unread : undefined} />
                <span className="mail-message-copy">
                  <span className="mail-message-meta"><strong>{addressLabel(message.from)}</strong><time>{formatDate(message.date, lang)}</time></span>
                  <span className="mail-message-subject">{message.subject}</span>
                  {message.hasAttachments ? <span className="mail-attachment-hint"><AppIcon name="paperclip" size={13} />{copy.attachments}</span> : null}
                </span>
                {message.flagged ? <AppIcon name="star" size={16} className="mail-star active" /> : null}
              </button>
            ))}
          </div>

          {data.total > 0 ? (
            <footer className="mail-pagination">
              <span>{data.total} {copy.results}</span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => { setPage((value) => value - 1); setSelectedUid(null); }}>{copy.previous}</button>
                <button type="button" disabled={!data.hasMore} onClick={() => { setPage((value) => value + 1); setSelectedUid(null); }}>{copy.next}</button>
              </div>
            </footer>
          ) : null}
        </section> : null}

        {data ? <article className={`mail-reader ${selectedUid ? "open" : ""}`}>
          {selectedUid ? <button type="button" className="mail-reader-back" onClick={() => setSelectedUid(null)}><AppIcon name="arrow-left" size={18} />{copy.inbox}</button> : null}
          {detailLoading ? <div className="mail-state"><div className="spinner" /></div> : null}
          {!detail && !detailLoading ? <div className="mail-state mail-reader-empty"><AppIcon name="mail" size={36} /><p>{copy.choose}</p></div> : null}
          {detail ? (
            <div className="mail-reader-content">
              <div className="mail-reader-header">
                <div>
                  <h1>{detail.subject}</h1>
                  <p><strong>{copy.from}:</strong> {addressLabel(detail.from)}</p>
                  <p><strong>{copy.to}:</strong> {addressLabel(detail.to)}</p>
                  {detail.cc.length ? <p><strong>{copy.cc}:</strong> {addressLabel(detail.cc)}</p> : null}
                  <time>{formatDate(detail.date, lang)}</time>
                </div>
                <button type="button" className={`icon-button mail-star ${detail.flagged ? "active" : ""}`} aria-label={copy.flagged} onClick={toggleFlag}>
                  <AppIcon name="star" size={20} />
                </button>
              </div>
              {detail.html ? <div className="mail-body-html" dangerouslySetInnerHTML={{ __html: detail.html }} /> : <div className="mail-body-text">{detail.text}</div>}
              {detail.attachments.length ? (
                <div className="mail-attachments">
                  <h2>{copy.attachments}</h2>
                  {detail.attachments.map((attachment) => (
                    <a
                      key={`${attachment.index}-${attachment.filename}`}
                      href={`/api/mail/attachment?folder=${encodeURIComponent(folder)}&uid=${detail.uid}&index=${attachment.index}`}
                      className="mail-attachment"
                    >
                      <AppIcon name="paperclip" size={17} />
                      <span><strong>{attachment.filename}</strong><small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small></span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </article> : null}
      </div>

      {composeOpen ? (
        <div className="dialog-backdrop mail-compose-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !isSending) setComposeOpen(false); }}>
          <form className="mail-compose" onSubmit={submitMessage}>
            <header><h2>{copy.compose}</h2><button type="button" className="icon-button" aria-label={copy.cancel} onClick={() => setComposeOpen(false)}><AppIcon name="x" size={19} /></button></header>
            <label>{copy.to}<input name="to" type="text" required maxLength={2000} autoComplete="off" /></label>
            <div className="mail-compose-copy-fields">
              <label>{copy.cc}<input name="cc" type="text" maxLength={2000} autoComplete="off" /></label>
              <label>{copy.bcc}<input name="bcc" type="text" maxLength={2000} autoComplete="off" /></label>
            </div>
            <label>{copy.subject}<input name="subject" type="text" maxLength={500} /></label>
            <label className="mail-compose-message">{copy.message}<textarea name="text" maxLength={200000} /></label>
            <label className="mail-file-input"><AppIcon name="paperclip" size={17} />{copy.attach}<input name="attachments" type="file" multiple /></label>
            {sendState === "error" ? <p className="mail-send-status error">{copy.sendFailed}</p> : null}
            {sendState === "sent" ? <p className="mail-send-status success">{copy.sentOk}</p> : null}
            <footer><button type="button" className="mail-cancel-button" onClick={() => setComposeOpen(false)} disabled={isSending}>{copy.cancel}</button><button type="submit" className="mail-send-button" disabled={isSending}><AppIcon name="send" size={17} />{isSending ? copy.sending : copy.send}</button></footer>
          </form>
        </div>
      ) : null}
      {sendState === "sent" && !composeOpen ? <div className="mail-toast"><AppIcon name="check" size={17} />{copy.sentOk}</div> : null}
    </div>
  );
}
