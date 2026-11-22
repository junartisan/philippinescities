import { Suspense } from "react";
import { connection } from "next/server";

async function Connection() {
  await connection();
  return null;
}

export function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  );
}
