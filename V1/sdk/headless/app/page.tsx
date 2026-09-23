"use client";
import dynamic from 'next/dynamic';
const SwapClient=dynamic(()=>import('./swap-client'),{ssr:false,loading:()=> <main className="page">Loading example…</main>});
export default function Page(){return <SwapClient/>;}
