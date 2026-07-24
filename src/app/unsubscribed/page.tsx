import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnsubscribedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">You&rsquo;ve been unsubscribed.</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        You won&rsquo;t receive the Finance Insights newsletter anymore.
      </p>
      <Link href="/">
        <Button variant="outline">Back to the globe</Button>
      </Link>
    </div>
  );
}
