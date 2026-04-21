import { permanentRedirect } from "next/navigation";

/*
  /browse is deprecated — the catalog is now at /.
  permanentRedirect sends a 308 so Google updates its index to / instead
  of retrying /browse on future crawls. `redirect()` would have sent 307
  which keeps the deprecated URL alive in Google's eyes.
*/
export default function BrowseRedirect() {
  permanentRedirect("/");
}
