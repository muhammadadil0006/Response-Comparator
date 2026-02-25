import { ComparisonContainer } from '@/components/comparison/ComparisonContainer';

interface CompareDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompareDetailPage({ params }: CompareDetailPageProps) {
  const { id } = await params;
  return <ComparisonContainer initialComparisonId={id} />;
}
