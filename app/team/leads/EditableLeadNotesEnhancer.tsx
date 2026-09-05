"use client";

import { useEffect, useRef } from "react";

type Note = {
  id: string;
  opportunity_id: string;
  author_name: string;
  note_text: string;
  created_at: string;
  updated_at?: string | null;
};

type Props = {
  notesByLead: Record<string, Note[]>;
};

type SavedOverride = {
  note_text: string;
  updated_at: string;
};

function normalize(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function editedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Edited";
  return `Edited ${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}

export default function EditableLeadNotesEnhancer({ notesByLead }: Props) {
  const overrides = useRef(new Map<string, SavedOverride>());

  useEffect(() => {
    const allNotes = Object.values(notesByLead).flat();
    let scheduled = false;

    function enhance() {
      scheduled = false;
      const headings = Array.from(document.querySelectorAll("h3")).filter(
        (node) => normalize(node.textContent) === "Sales Notes",
      );

      for (const heading of headings) {
        const section = heading.closest("section");
        if (!section) continue;
        const cards = Array.from(section.querySelectorAll("article"));

        for (const card of cards) {
          const element = card as HTMLElement;
          if (element.dataset.editableSalesNote === "true") continue;
          const paragraph = card.querySelector("p");
          const strong = card.querySelector("strong");
          if (!paragraph || !strong) continue;
          const paragraphElement = paragraph as HTMLParagraphElement;

          const originalText = normalize(paragraphElement.textContent);
          const author = normalize(strong.textContent);
          const candidates = allNotes.filter(
            (note) => normalize(note.note_text) === originalText && normalize(note.author_name) === author,
          );
          const note = candidates[0];
          if (!note) continue;

          element.dataset.editableSalesNote = "true";
          const override = overrides.current.get(note.id);
          if (override) paragraphElement.textContent = override.note_text;

          const actions = document.createElement("div");
          actions.style.display = "flex";
          actions.style.alignItems = "center";
          actions.style.gap = "8px";
          actions.style.marginTop = "6px";

          const edited = document.createElement("span");
          edited.style.fontSize = "11px";
          edited.style.color = "#7a8792";
          const initialUpdatedAt = override?.updated_at || note.updated_at || null;
          if (initialUpdatedAt && Math.abs(new Date(initialUpdatedAt).getTime() - new Date(note.created_at).getTime()) > 1000) {
            edited.textContent = editedLabel(initialUpdatedAt);
          }

          const editButton = document.createElement("button");
          editButton.type = "button";
          editButton.textContent = "✎";
          editButton.setAttribute("aria-label", "Edit sales note");
          editButton.title = "Edit note";
          editButton.style.marginLeft = "auto";
          editButton.style.border = "0";
          editButton.style.background = "transparent";
          editButton.style.padding = "2px 4px";
          editButton.style.cursor = "pointer";
          editButton.style.fontSize = "15px";

          actions.append(edited, editButton);
          card.append(actions);

          editButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (element.dataset.editingSalesNote === "true") return;
            element.dataset.editingSalesNote = "true";

            const currentText = paragraphElement.textContent || "";
            paragraphElement.style.display = "none";
            actions.style.display = "none";

            const editor = document.createElement("div");
            editor.style.display = "grid";
            editor.style.gap = "8px";
            editor.style.marginTop = "8px";

            const textarea = document.createElement("textarea");
            textarea.value = currentText;
            textarea.maxLength = 4000;
            textarea.rows = 4;
            textarea.style.width = "100%";
            textarea.style.resize = "vertical";
            textarea.style.padding = "10px 12px";
            textarea.style.border = "1px solid #cfd8df";
            textarea.style.borderRadius = "9px";
            textarea.style.font = "inherit";
            textarea.style.lineHeight = "1.45";

            const error = document.createElement("div");
            error.style.display = "none";
            error.style.color = "#a6372d";
            error.style.fontSize = "12px";
            error.style.fontWeight = "750";

            const buttons = document.createElement("div");
            buttons.style.display = "flex";
            buttons.style.gap = "8px";

            const save = document.createElement("button");
            save.type = "button";
            save.textContent = "Save";
            save.style.border = "0";
            save.style.borderRadius = "8px";
            save.style.padding = "7px 11px";
            save.style.fontWeight = "850";
            save.style.background = "#f6c600";
            save.style.cursor = "pointer";

            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.textContent = "Cancel";
            cancel.style.border = "1px solid #d6dde3";
            cancel.style.borderRadius = "8px";
            cancel.style.padding = "7px 11px";
            cancel.style.fontWeight = "750";
            cancel.style.background = "white";
            cancel.style.cursor = "pointer";

            function closeEditor() {
              editor.remove();
              paragraphElement.style.display = "";
              actions.style.display = "flex";
              delete element.dataset.editingSalesNote;
            }

            cancel.addEventListener("click", (cancelEvent) => {
              cancelEvent.preventDefault();
              cancelEvent.stopPropagation();
              closeEditor();
            });

            save.addEventListener("click", async (saveEvent) => {
              saveEvent.preventDefault();
              saveEvent.stopPropagation();
              const text = textarea.value.trim();
              if (!text) {
                error.textContent = "Note cannot be blank.";
                error.style.display = "block";
                return;
              }

              save.disabled = true;
              cancel.disabled = true;
              save.textContent = "Saving…";
              error.style.display = "none";

              try {
                const response = await fetch("/api/team/notes", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ scope: "lead", note_id: note.id, note_text: text }),
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Unable to update note.");
                const nextText = String(payload.note?.note_text || text);
                const nextUpdatedAt = String(payload.note?.updated_at || new Date().toISOString());
                overrides.current.set(note.id, { note_text: nextText, updated_at: nextUpdatedAt });
                paragraphElement.textContent = nextText;
                edited.textContent = editedLabel(nextUpdatedAt);
                closeEditor();
              } catch (err) {
                error.textContent = err instanceof Error ? err.message : "Unable to update note.";
                error.style.display = "block";
                save.disabled = false;
                cancel.disabled = false;
                save.textContent = "Save";
              }
            });

            buttons.append(save, cancel);
            editor.append(textarea, error, buttons);
            actions.before(editor);
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
          });
        }
      }
    }

    function scheduleEnhance() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(enhance);
    }

    enhance();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [notesByLead]);

  return null;
}
