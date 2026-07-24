import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SubscribedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">You&rsquo;re subscribed.</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The Finance Insights newsletter lands in your inbox every Tuesday and Friday.
      </p>
      <Link href="/">
        <Button variant="outline">Back to the globe</Button>
      </Link>
    </div>
  );
}
