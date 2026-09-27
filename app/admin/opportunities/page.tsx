import { ListingIndex, type ListingKind } from "../listing-pages";
export const dynamic = "force-dynamic";
export default function AdminOpportunitiesPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) { return <ListingIndex kind={"opportunities" as ListingKind} searchParams={searchParams}/>; }
