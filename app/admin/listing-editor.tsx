import Link from "next/link";
import { saveListing } from "../lib/actions/listings";
import { DeleteListingForm } from "./delete-listing-form";

type Kind = "events" | "opportunities";
type Values = Record<string, string | boolean | null | undefined>;
function val(values: Values, key: string): string { return String(values[key] ?? ""); }
function Field({ values, name, label, type = "text", required = false, help, long = false }: { values: Values; name: string; label: string; type?: string; required?: boolean; help?: string; long?: boolean }) {
  const value = val(values, name);
  return <label className={long ? "admin-field admin-field-wide" : "admin-field"}>{label}{help && <span>{help}</span>}{long ? <textarea name={name} required={required} maxLength={5000} rows={5} defaultValue={value}/> : <input name={name} type={type} required={required} defaultValue={type === "datetime-local" && value ? new Date(value).toISOString().slice(0, 16) : value}/>}</label>;
}

export function ListingEditor({ kind, values = {}, existing = false }: { kind: Kind; values?: Values; existing?: boolean }) {
  const event = kind === "events";
  return <>
    <form action={saveListing} className="admin-listing-form">
      <input type="hidden" name="kind" value={kind}/>{existing && <input type="hidden" name="id" value={val(values, "id")}/>}
      <div className="admin-form-grid">
        <Field values={values} name="title" label={event ? "Event title" : "Opportunity title"} required/>
        <Field values={values} name="category" label="Category" required/>
        {event ? <>
          <Field values={values} name="event_date" label="Event date" type="date" required/>
          <Field values={values} name="organizer" label="Organiser / department"/>
          <Field values={values} name="start_time" label="Start time" type="time"/>
          <Field values={values} name="end_time" label="End time" type="time"/>
          <Field values={values} name="location" label="Location"/>
          <Field values={values} name="event_url" label="Event or registration link" type="url" help="Optional. Leave blank if there is no registration page."/>
        </> : <>
          <Field values={values} name="organization" label="Organisation / department"/>
          <Field values={values} name="opens_at" label="Opens" type="datetime-local" required/>
          <Field values={values} name="deadline" label="Application deadline" type="date"/>
          <Field values={values} name="eligibility" label="Eligibility"/>
          <Field values={values} name="location" label="Location"/>
          <Field values={values} name="mode" label="Mode" help="For example, in person, online or hybrid."/>
          <Field values={values} name="application_url" label="Application link" type="url"/>
          <Field values={values} name="action_label" label="Link label"/>
        </>}
        <Field values={values} name="image_url" label="Image URL" type="url" help="Optional; use an http or https image URL."/>
        <label className="admin-field">Publication status<select name="status" defaultValue={val(values, "status") || "draft"}><option value="draft">Draft — admin only</option><option value="published">Published — visible publicly</option><option value="archived">Archived — admin only</option></select></label>
        <Field values={values} name="description" label="Description / details" long/>
      </div>
      {val(values, "is_sample") === "true" && <p className="admin-sample-note">Sample listing · retained for visual testing. Sample entries cannot be deleted.</p>}
      <div className="admin-listing-actions"><button className="writing-submit" type="submit">{existing ? "Save changes" : "Create listing"}</button><Link href={`/admin/${kind}`}>Cancel</Link><small>Changes publish according to the status selected above.</small></div>
    </form>
    {existing && val(values, "is_sample") !== "true" && <div className="admin-delete-panel"><DeleteListingForm kind={kind} id={val(values, "id")}/></div>}
  </>;
}
