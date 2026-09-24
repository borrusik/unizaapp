"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AppIcon } from "@/components/AppIcon";

const KHARKIV_ARMS = "https://upload.wikimedia.org/wikipedia/commons/7/71/Coat_of_arms_of_Kharkiv.svg";
const KHARKIV_SOURCE = "https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Kharkiv.svg";

export function KharkivEasterEgg({ className = "brand-mark", iconSize = 25 }: { className?: string; iconSize?: number }) {
  const [clicks, setClicks] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const reveal = () => {
    const next = clicks + 1;
    if (next >= 7) {
      setClicks(0);
      setOpen(true);
    } else {
      setClicks(next);
    }
  };

  return (
    <>
      <button type="button" className={`${className} brand-trigger`} onClick={reveal} aria-label="UNIZA Student">
        <AppIcon name="book" size={iconSize} />
      </button>
      {open && (
        <div className="kharkiv-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="kharkiv-card" role="dialog" aria-modal="true" aria-labelledby="kharkiv-title">
            <button type="button" className="kharkiv-close" onClick={() => setOpen(false)} aria-label="Close">
              <AppIcon name="x" size={19} />
            </button>
            <Image src={KHARKIV_ARMS} alt="Герб Харкова" width={180} height={214} priority={false} />
            <p>Пасхалку знайдено</p>
            <h2 id="kharkiv-title">Привіт із Харкова 💚</h2>
            <span>Від студента — студентам.</span>
            <a href={KHARKIV_SOURCE} target="_blank" rel="noopener noreferrer">
              Wikimedia Commons <AppIcon name="external-link" size={14} />
            </a>
          </section>
        </div>
      )}
    </>
  );
}
