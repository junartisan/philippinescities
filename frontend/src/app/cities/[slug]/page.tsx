import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageLoader } from "@/components/ui";
import CityClient from "./city-client";

export default function CityDetailPage() {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<PageLoader label="Loading city…" />}>
        <CityClient />
      </Suspense>
    </>
  );
}
