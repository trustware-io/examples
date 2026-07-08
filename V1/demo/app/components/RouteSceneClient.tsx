"use client";

import dynamic from "next/dynamic";

const RouteScene = dynamic(() => import("./RouteScene"), { ssr: false });

export default function RouteSceneClient() {
  return <RouteScene />;
}
