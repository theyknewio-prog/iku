import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function LegacyVideoPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/watch/${slug}`);
}
