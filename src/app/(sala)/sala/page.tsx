import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { FEATURES } from '@/lib/features';
import { HyperbeamRoomClient } from '@/components/hyperbeam/HyperbeamRoomClient';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SalaPage() {
  if (!FEATURES.hyperbeam) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="px-4 py-12">
          <Skeleton className="mb-4 h-10 w-48" />
          <Skeleton className="h-[60vh] w-full rounded-xl" />
        </div>
      }
    >
      <HyperbeamRoomClient />
    </Suspense>
  );
}
