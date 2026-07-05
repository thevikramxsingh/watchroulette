---
status: accepted
---

# Spin animation is synced across friends via polling, not Realtime

Context: watching the wheel spin together is the actual centerpiece of the "gamified decision" premise — a button that silently outputs a movie name loses what makes this fun. But we'd already deliberately ruled out Supabase Realtime/websockets elsewhere in the spec (see Architecture: Sync) to avoid connection-lifecycle complexity in a one-day build, and true synced animation normally implies a live channel.

Decided instead: the spinner's client picks the winner immediately using the weighted-random algorithm (see ADR 0001) and writes `{chosen_movie_id, spin_started_at}` to `game_lobby` right away, before its own animation even finishes. Every other client detects the new `spin_started_at` on its next poll (up to ~4s later, matching our existing poll interval) and plays the same fixed-duration wheel animation locally, landing on the same pre-decided winner. No client ever computes its own random outcome — the winner is decided once, by whoever clicked spin, and everyone else just replays the reveal.

Consequence: friends can see the reveal up to ~4 seconds apart depending on poll timing. Accepted as a minor, honest cost — for a friend group deciding together in the same room, this doesn't undermine the "watched it together" feeling the way a fully silent update would.

Considered options: true Realtime broadcast (rejected — reopens the connection-management complexity we already scoped out); spinner-only animation with silent updates for everyone else (rejected — guts the core fun of the mechanic).
