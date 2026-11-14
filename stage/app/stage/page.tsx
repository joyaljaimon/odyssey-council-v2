import { Suspense } from "react";
import Stage from "./Stage";

export default function StagePage() {
  return (
    <Suspense>
      <Stage />
    </Suspense>
  );
}
