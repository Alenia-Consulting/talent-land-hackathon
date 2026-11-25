// Finding a place in the catalogue, and what the search screen is showing while it looks.
//
// A visitor arrives knowing the name of the place they are going to, not a slug: "el hospital de
// occidente". What is here turns that into one card. It lives apart from the screen, pure,
// because a wrong answer costs somebody the guide they came for, and because in this app the
// components are not tested and the pure modules are.
//
// Two product rules live here:
//   · A search that finds nothing is never a dead end. "noMatch" is a state of its own, apart
//     from "empty", so the screen can tell "nobody has published anything yet" from "that name
//     is not in the catalogue" and offer the whole list back.
//   · Nothing is normalised away from what the venue wrote. The comparison ignores accents and
//     capitals; the names on screen stay exactly as the venue typed them.

/** Lower case, without accents, spaces collapsed. For comparing — never for showing. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Searchable = { venue_name: string; title: string };

/**
 * The guides that match what has been typed, in the order the server sent them.
 *
 * Every word has to turn up somewhere in the name of the place or the title of the route, so
 * "hospital occidente" finds "Hospital General de Occidente" and "hospital trinidad" finds
 * nothing rather than every hospital. An empty query is not a filter that matches everything: it
 * is somebody who has not typed yet, and they get the catalogue.
 */
export function filterCatalogue<G extends Searchable>(guides: readonly G[], query: string): G[] {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return [...guides];

  return guides.filter((guide) => {
    const haystack = normalize(`${guide.venue_name} ${guide.title}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** What the search screen is showing right now. */
export type CatalogueState = "loading" | "error" | "empty" | "noMatch" | "list";

export function catalogueState({
  guides,
  matches,
  error,
}: {
  guides: readonly unknown[] | null;
  matches: readonly unknown[];
  error: string | null;
}): CatalogueState {
  // The failure is read first. A catalogue that never arrived must not look like a catalogue that
  // is empty, or the visitor is told nobody has published anything when the truth is that their
  // phone has no connection.
  if (error) return "error";
  if (guides === null) return "loading";
  if (guides.length === 0) return "empty";
  return matches.length === 0 ? "noMatch" : "list";
}
