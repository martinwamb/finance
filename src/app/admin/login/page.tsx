import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: "Sign-in was cancelled.",
  not_admin: "That Google account isn't authorized for admin access.",
  google_failed: "Something went wrong signing in with Google. Try again.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admin sign in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="text-sm text-destructive">
              {ERROR_MESSAGES[error] ?? "Sign-in failed."}
            </p>
          )}
          <Link href="/api/auth/google">
            <Button className="w-full">Sign in with Google</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
