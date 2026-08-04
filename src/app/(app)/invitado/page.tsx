import { redirect } from "next/navigation";

/** Guest bookings now run through the same step-by-step wizard. */
export default function InvitadoPage() {
  redirect("/reservar?guest=1");
}
