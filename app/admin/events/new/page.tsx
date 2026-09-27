import { ListingCreate } from "../../listing-pages";
export const dynamic = "force-dynamic";
export default function NewAdminEventPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) { return <ListingCreate kind="events" searchParams={searchParams}/>; }
