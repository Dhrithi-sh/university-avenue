import { ListingCreate } from "../../listing-pages";
export const dynamic = "force-dynamic";
export default function NewAdminOpportunityPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) { return <ListingCreate kind="opportunities" searchParams={searchParams}/>; }
