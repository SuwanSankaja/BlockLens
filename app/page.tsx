import ExplorerApp from "@/components/ExplorerApp";
import { GENESIS_ADDRESS } from "@/lib/utils/presets";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const initialQuery = q?.trim() || GENESIS_ADDRESS;

  return <ExplorerApp initialQuery={initialQuery} />;
}
