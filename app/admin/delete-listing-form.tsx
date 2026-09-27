"use client";

import { deleteListing } from "../lib/actions/listings";

export function DeleteListingForm({ kind, id }: { kind: "events" | "opportunities"; id: string }) {
  return <form action={deleteListing} onSubmit={event => {
    if (!window.confirm("Permanently delete this listing? This cannot be undone.")) event.preventDefault();
  }}><input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={id}/><button className="admin-delete-link" type="submit">Delete permanently</button></form>;
}
