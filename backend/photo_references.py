"""Clean source references without changing any other editorial content."""
import copy


def remove_from_layout(layout, photo_id):
    result = copy.deepcopy(layout or {})
    if "photo_ids" in result:
        result["photo_ids"] = [i for i in result["photo_ids"] if i != photo_id]
    for key in ("placements", "filmstrip_placements"):
        if key in result:
            result[key] = [p for p in result[key] if p["photo_id"] != photo_id]
    if "photo_edits" in result:
        result["photo_edits"].pop(str(photo_id), None)
    return result


def remove_from_snapshot(snapshot, photo_id):
    result = copy.deepcopy(snapshot)
    result["photos"] = [p for p in result.get("photos", []) if p["id"] != photo_id]
    result["photo_count"] = len(result["photos"])
    if result.get("cover_id") == photo_id or (result.get("cover") or {}).get("id") == photo_id:
        result["cover"] = result["photos"][0] if result["photos"] else None
        result["cover_id"] = result["cover"]["id"] if result["cover"] else None
    result["layout"], result["filmstrip_ids"] = remove_filmstrip_reference(result.get("layout"), result.get("filmstrip_ids", []), photo_id)
    for chapter in result.get("chapters", []):
        chapter["layout"] = remove_from_layout(chapter.get("layout"), photo_id)
    return result


def remove_filmstrip_reference(layout, ids, photo_id):
    layout = remove_from_layout(layout, photo_id)
    remaining = [i for i in ids if i != photo_id]
    # Keep short strips visible using the modular sequence while retaining the legacy API invariant.
    if 0 < len(remaining) < 6 and "filmstrip_placements" not in layout:
        layout["filmstrip_placements"] = [
            {"id": f"film:{index}:{i}", "photo_id": i} for index, i in enumerate(remaining)
        ]
    return layout, remaining if len(remaining) >= 6 else []
