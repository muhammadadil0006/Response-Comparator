/**
 * /share/[id] — public, always-read-only share route.
 *
 * Behaviour:
 *   • Non-owner  → read-only view with a banner.
 *   • Owner      → ComparisonContainer detects ownership via `is_owner` from
 *                  the API and silently redirects to /compare/<id> (their
 *                  editable version).  See the `forceReadOnly` + redirect
 *                  logic in ComparisonContainer.
 */
import { ComparisonContainer } from '@/components/comparison/ComparisonContainer';

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  // forceReadOnly tells the container to always start in read-only mode.
  // If the API returns is_owner === true the container will redirect to
  // /compare/<id> so the owner lands on their real, editable chat.
  return <ComparisonContainer initialComparisonId={id} forceReadOnly />;
}
