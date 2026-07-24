"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { subscribeAction, type SubscribeState } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: SubscribeState = { success: false, message: "" };

export function SubscribeForm() {
  const [state, formAction, pending] = useActionState(subscribeAction, initialState);

  useEffect(() => {
    if (!state.message) return;
    if (state.success) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="flex w-full max-w-sm gap-2">
      <Input
        type="email"
        name="email"
        placeholder="you@example.com"
        required
        className="bg-background"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Subscribe"}
      </Button>
    </form>
  );
}
