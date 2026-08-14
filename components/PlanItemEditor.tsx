"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanItem = {
  id: string;
  advertisementId: string;
  plannedAt: string;
  masterCaption: string;
  facebookCaption: string | null;
  instagramCaption: string | null;
  useSameCaption: boolean;
  captionState: string;
  manualPinned: boolean;
};

export function PlanItemEditor({ planId, item, approvedAdverts }: {
  planId: string;
  item: PlanItem;
  approvedAdverts: { id: string; productName: string; sku: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [master, setMaster] = useState(item.masterCaption);
  const [facebook, setFacebook] = useState(item.facebookCaption || item.masterCaption);
  const [instagram, setInstagram] = useState(item.instagramCaption || item.masterCaption);
  const [same, setSame] = useState(item.useSameCaption);
  const [pinned, setPinned] = useState(item.manualPinned);
  const [advertisementId, setAdvertisementId] = useState(item.advertisementId);
  const [plannedAt, setPlannedAt] = useState(item.plannedAt.slice(0, 16));
  const [message, setMessage] = useState("");

  async function update(body: Record<string, unknown>) {
    const response = await fetch(`/api/plans/${planId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: item.id, ...body }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Plan updated" : result.error || "Could not update plan");
    if (response.ok) router.refresh();
  }

  async function save() {
    await update({
      advertisementId,
      plannedAt: new Date(plannedAt).toISOString(),
      masterCaption: master,
      facebookCaption: facebook,
      instagramCaption: instagram,
      useSameCaption: same,
      captionState: "READY",
      manualPinned: pinned,
      overrideReason: advertisementId !== item.advertisementId ? "Manual approved-advert replacement" : undefined,
    });
  }

  return <div className="plan-item-editor">
    <div className="action-row">
      <button className="secondary-button" onClick={() => setOpen((value) => !value)}>{open ? "Close editor" : "Edit plan item"}</button>
      <button className="secondary-button" onClick={() => update({ action: "move", positionDelta: -1 })}>Move up</button>
      <button className="secondary-button" onClick={() => update({ action: "move", positionDelta: 1 })}>Move down</button>
      <button className="danger-button" onClick={() => confirm("Remove this item from the draft plan?") && update({ action: "remove" })}>Remove</button>
    </div>
    {open && <div className="editor-drawer">
      <label className="field"><span>Approved advert</span><select value={advertisementId} onChange={(event) => setAdvertisementId(event.target.value)}>{approvedAdverts.map((advert) => <option value={advert.id} key={advert.id}>{advert.productName} ({advert.sku})</option>)}</select></label>
      <label className="field"><span>Planned date and time</span><input type="datetime-local" value={plannedAt} onChange={(event) => setPlannedAt(event.target.value)} /></label>
      <label className="check-row"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Manually pinned</label>
      <label className="check-row"><input type="checkbox" checked={same} onChange={(event) => setSame(event.target.checked)} /> Use same caption for all</label>
      <label className="field"><span>Master caption</span><textarea rows={5} value={master} onChange={(event) => setMaster(event.target.value)} /></label>
      {!same && <div className="platform-caption-grid">
        <label className="field"><span>Facebook</span><textarea rows={5} value={facebook} onChange={(event) => setFacebook(event.target.value)} /></label>
        <label className="field"><span>Instagram</span><textarea rows={5} value={instagram} onChange={(event) => setInstagram(event.target.value)} /></label>
      </div>}
      <button className="primary-button" onClick={save}>Save READY item</button>
      {message && <span>{message}</span>}
    </div>}
  </div>;
}
