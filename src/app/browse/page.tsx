import { redirect } from "next/navigation";

/*
  /browse is deprecated — the catalog is now at /.
  Permanent redirect so existing links and bookmarks still work.
*/
export default function BrowseRedirect() {
  redirect("/");
}
