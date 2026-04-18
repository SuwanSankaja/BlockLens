import ExplorerApp from "@/components/ExplorerApp";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return <ExplorerApp initialQuery={q} />;
}
