import { ListingEdit } from "../../listing-pages";
export const dynamic = "force-dynamic";
export default async function EditAdminOpportunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) { const { id } = await params; return <ListingEdit kind="opportunities" id={id} searchParams={searchParams}/>; }
