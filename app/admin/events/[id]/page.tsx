import { ListingEdit } from "../../listing-pages";
export const dynamic = "force-dynamic";
export default async function EditAdminEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) { const { id } = await params; return <ListingEdit kind="events" id={id} searchParams={searchParams}/>; }
