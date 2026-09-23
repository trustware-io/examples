"use client";
import dynamic from 'next/dynamic';
const WidgetClient=dynamic(()=>import('./widget-client'),{ssr:false,loading:()=> <main className="page">Loading example…</main>});
export default function Page(){return <WidgetClient/>;}
