import Link from "next/link";

export default function Privacy() {
  return <main className="mx-auto max-w-3xl px-6 py-12 text-[#17211d]">
    <Link href="/" className="text-sm underline">← Back to Locus</Link>
    <h1 className="mt-8 text-4xl font-medium tracking-tight">Your conversation and privacy</h1>
    <div className="mt-8 space-y-6 text-base leading-7 text-[#59645f]">
      <p>Locus processes the text you type, the guide’s replies, the order of messages, and the time between a question and your answer. Timing includes reading and typing; it is not a measure of your brain.</p>
      <p>With the live guide enabled, recent conversation text is sent through the server to the configured AI provider after you send a message. When you finish, the full conversation and response timing are sent for analysis. Extracted idea text is also sent for embeddings. The current implementation uses OpenAI for these requests.</p>
      <p>The app has no session database. While a session is open, text, results, and temporary request data are held in your browser’s memory and in server memory during processing. “New session” clears the app’s current session and its analysis cache and cancels pending requests. Reloading or closing the page ends the in-page session; this is not a guarantee of secure erasure from device memory.</p>
      <p>AI and hosting providers may retain requests or operational logs under their own policies and the operator’s account settings. Locus cannot promise zero retention by providers or hosts. The app’s API responses use no-store, and its error logs omit conversation content and raw provider errors.</p>
      <p>Please do not enter names, contact details, private, medical, financial, or other identifying information. Anyone who runs or modifies their own copy is responsible for describing their own providers, hosting, and retention settings accurately.</p>
      <p>Read the <a className="underline" href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noreferrer">OpenAI privacy policy</a> and the <a className="underline" href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">Vercel privacy policy</a> for the providers used by the hosted demo. This is an exploratory text experiment, not a validated creativity test.</p>
    </div>
  </main>;
}
