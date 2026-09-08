"use client";

import { useEffect } from "react";

type Note = {
  note_id: string;
  note_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function confirmationFromDrawer(drawer: HTMLElement) {
  const values = Array.from(drawer.querySelectorAll("strong"))
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean);
  return values.find((value) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(value))?.toUpperCase() || "";
}

function findOldNotesSection(drawer: HTMLElement) {
  return Array.from(drawer.querySelectorAll<HTMLElement>("section")).find((section) =>
    section.querySelector("h3")?.textContent?.trim().toLowerCase() === "important notes",
  ) || null;
}

function fmt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone:"America/Denver", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }).format(date);
}

export default function StaffNotesDrawerEnhancer() {
  useEffect(() => {
    let busy = false;

    async function enhance(drawer: HTMLElement) {
      if (drawer.dataset.staffNotesReady === "true" || busy) return;
      const old = findOldNotesSection(drawer);
      if (!old) return;
      const confirmation = confirmationFromDrawer(drawer);
      if (!confirmation) return;

      busy = true;
      try {
        const response = await fetch(`/api/team/readiness/notes?confirmation=${encodeURIComponent(confirmation)}`, { cache:"no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load notes.");

        const notes: Note[] = payload.notes || [];
        const legacy = typeof payload.legacy_note === "string" && payload.legacy_note.trim()
          ? { note_id:"legacy", note_text:payload.legacy_note.trim(), created_by:null, created_at:"", updated_at:"" }
          : null;

        const shell = document.createElement("section");
        shell.dataset.staffNotesEnhanced = "true";
        shell.style.cssText = "margin-top:24px;border:1px solid #ead891;background:#fffbea;border-radius:12px;padding:18px;";
        old.insertAdjacentElement("beforebegin", shell);
        old.style.display = "none";
        drawer.dataset.staffNotesReady = "true";

        let items = legacy ? [legacy, ...notes] : [...notes];
        let composerOpen = false;
        let editingId = "";
        let draft = "";

        async function request(method:string, body:Record<string,unknown>) {
          const res = await fetch("/api/team/readiness/notes", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify({ confirmation, ...body }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Unable to save note.");
          return data;
        }

        function render() {
          shell.innerHTML = "";
          const header = document.createElement("div");
          header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;";
          header.innerHTML = `<h3 style="margin:0;color:#7a5b00;font-size:20px">Important Notes</h3>`;
          const add = document.createElement("button");
          add.type = "button"; add.textContent = "+ Add Note";
          add.style.cssText = "border:1px solid #d5521d;background:#fff;color:#d5521d;border-radius:8px;padding:8px 11px;font-weight:800;cursor:pointer";
          add.onclick = () => { composerOpen = true; editingId = ""; draft = ""; render(); };
          header.appendChild(add); shell.appendChild(header);

          if (!items.length && !composerOpen) {
            const empty = document.createElement("div");
            empty.textContent = "No notes yet.";
            empty.style.cssText = "padding:12px;border:1px dashed #d9c978;border-radius:9px;background:#fff;color:#7b8491;font-size:12px";
            shell.appendChild(empty);
          }

          items.forEach((note) => {
            const card = document.createElement("div");
            card.style.cssText = "margin-top:8px;padding:12px 13px;border:1px solid #e4d99d;border-radius:10px;background:#fff";
            if (editingId === note.note_id) {
              const area = document.createElement("textarea"); area.value = draft; area.rows = 3;
              area.style.cssText = "width:100%;resize:vertical;border:1px solid #d8dee5;border-radius:8px;padding:10px;font:inherit;box-sizing:border-box";
              area.oninput = () => { draft = area.value; };
              card.appendChild(area);
              const row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;margin-top:8px";
              const save = document.createElement("button"); save.textContent = "Save"; save.type="button"; save.style.cssText="border:0;background:#202733;color:#fff;border-radius:7px;padding:7px 11px;font-weight:800;cursor:pointer";
              save.onclick = async () => { if (!draft.trim()) return; save.textContent="Saving..."; try { await request("PATCH", { note_id:note.note_id, note_text:draft.trim() }); note.note_text=draft.trim(); editingId=""; render(); } catch(e){ window.alert(e instanceof Error?e.message:"Unable to save note."); render(); } };
              const cancel = document.createElement("button"); cancel.textContent="Cancel"; cancel.type="button"; cancel.style.cssText="border:1px solid #d8dee5;background:#fff;border-radius:7px;padding:7px 11px;font-weight:800;cursor:pointer"; cancel.onclick=()=>{editingId="";render();};
              const del = document.createElement("button"); del.textContent="Delete"; del.type="button"; del.style.cssText="margin-left:auto;border:0;background:transparent;color:#b42318;font-weight:800;cursor:pointer"; del.onclick=async()=>{ if(!window.confirm("Delete this note?")) return; try{await request("DELETE",{note_id:note.note_id});items=items.filter((item)=>item.note_id!==note.note_id);editingId="";render();}catch(e){window.alert(e instanceof Error?e.message:"Unable to delete note.");}};
              row.append(save,cancel,del); card.appendChild(row);
            } else {
              const top = document.createElement("div"); top.style.cssText="display:flex;align-items:flex-start;justify-content:space-between;gap:10px";
              const text = document.createElement("div"); text.textContent=note.note_text; text.style.cssText="white-space:pre-wrap;color:#25303b;font-size:13px;line-height:1.45";
              const edit = document.createElement("button"); edit.type="button"; edit.textContent="✎"; edit.setAttribute("aria-label","Edit note"); edit.style.cssText="border:0;background:transparent;color:#6f7885;font-size:16px;cursor:pointer;padding:0"; edit.onclick=()=>{editingId=note.note_id;draft=note.note_text;render();};
              top.append(text,edit); card.appendChild(top);
              const meta = document.createElement("div"); meta.style.cssText="margin-top:7px;color:#8a94a1;font-size:10px"; meta.textContent = note.note_id === "legacy" ? "Existing readiness note" : [fmt(note.created_at), note.created_by ? `by ${note.created_by}` : ""].filter(Boolean).join(" · "); card.appendChild(meta);
            }
            shell.appendChild(card);
          });

          if (composerOpen) {
            const composer = document.createElement("div"); composer.style.cssText="margin-top:10px;padding:12px;border:1px solid #e4d99d;border-radius:10px;background:#fff";
            const area = document.createElement("textarea"); area.rows=3; area.placeholder="Add a note for this guest..."; area.style.cssText="width:100%;resize:vertical;border:1px solid #d8dee5;border-radius:8px;padding:10px;font:inherit;box-sizing:border-box"; area.oninput=()=>{draft=area.value;}; composer.appendChild(area);
            const actions=document.createElement("div"); actions.style.cssText="display:flex;gap:8px;margin-top:8px";
            const save=document.createElement("button"); save.type="button"; save.textContent="Save Note"; save.style.cssText="border:0;background:#d5521d;color:#fff;border-radius:7px;padding:8px 12px;font-weight:800;cursor:pointer"; save.onclick=async()=>{if(!draft.trim())return;save.textContent="Saving...";try{const data=await request("POST",{note_text:draft.trim()});items=[data.note as Note,...items];composerOpen=false;draft="";render();}catch(e){window.alert(e instanceof Error?e.message:"Unable to save note.");render();}};
            const cancel=document.createElement("button"); cancel.type="button";cancel.textContent="Cancel";cancel.style.cssText="border:1px solid #d8dee5;background:#fff;border-radius:7px;padding:8px 12px;font-weight:800;cursor:pointer";cancel.onclick=()=>{composerOpen=false;draft="";render();};actions.append(save,cancel);composer.appendChild(actions);shell.appendChild(composer);
          }
        }
        render();
      } catch (error) {
        console.error("Readiness notes enhancement failed", error);
      } finally { busy = false; }
    }

    function scan() {
      document.querySelectorAll<HTMLElement>('[role="dialog"][aria-label$="reservation details"]').forEach((drawer) => void enhance(drawer));
    }
    const observer = new MutationObserver(scan); observer.observe(document.body,{childList:true,subtree:true}); scan();
    return () => observer.disconnect();
  }, []);
  return null;
}
