"""Mutate snapshot metadata: rename, pin, delete.

Deletion is allowed only for unpinned snapshots — pinned/named ones are
user-curated and survive nightly rollup.
"""

import trivena_framework as trivena


def set_label(snapshot_id: str, label: str | None, pinned: bool | None = None) -> dict:
	"""Update a snapshot's label and/or pinned flag.

	Setting a non-empty label implicitly promotes the snapshot to `kind=named`
	and pins it; clearing the label demotes it back to `kind=auto` (unless
	pinned was explicitly set).
	"""
	snap = trivena.get_doc("Sheet Snapshot", snapshot_id)
	trivena.has_permission("Sheet", doc=snap.sheet, ptype="write", throw=True)

	if label is not None:
		clean = label.strip()
		snap.label = clean or None
		if clean:
			snap.kind = "named"
			snap.pinned = 1
		else:
			# Cleared the label — demote unless caller insists on pinned.
			snap.kind = "auto" if snap.kind == "named" else snap.kind
			if pinned is None:
				snap.pinned = 0

	if pinned is not None:
		snap.pinned = 1 if pinned else 0

	snap.save(ignore_permissions=True)
	return {"id": snap.name, "label": snap.label, "kind": snap.kind, "pinned": bool(snap.pinned)}


def delete(snapshot_id: str) -> dict:
	"""Delete an unpinned snapshot. Pinned ones must be unpinned first."""
	snap = trivena.db.get_value(
		"Sheet Snapshot", snapshot_id, ["sheet", "pinned"], as_dict=True
	)
	if not snap:
		trivena.throw(f"Snapshot {snapshot_id} not found")
	trivena.has_permission("Sheet", doc=snap.sheet, ptype="write", throw=True)
	if snap.pinned:
		trivena.throw("Cannot delete a pinned snapshot — unpin it first")

	trivena.delete_doc("Sheet Snapshot", snapshot_id, ignore_permissions=True)
	# If we just deleted the head_snapshot, fall back to the next-most-recent.
	current_head = trivena.db.get_value("Sheet", snap.sheet, "head_snapshot")
	if current_head == snapshot_id:
		next_snap = trivena.get_all(
			"Sheet Snapshot",
			filters={"sheet": snap.sheet},
			fields=["name"],
			order_by="seq desc",
			limit=1,
		)
		trivena.db.set_value(
			"Sheet",
			snap.sheet,
			"head_snapshot",
			next_snap[0]["name"] if next_snap else None,
			update_modified=False,
		)
	return {"deleted": snapshot_id}
