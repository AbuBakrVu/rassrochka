import CoinvestorDetail from "@/components/coinvestor-detail";

export default async function CoinvestorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CoinvestorDetail id={id} />;
}
