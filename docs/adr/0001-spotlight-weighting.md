---
status: accepted
---

# Spotlight uses a fixed group-probability target, not a flat per-movie multiplier

Context: the spin wheel needed a way to let someone boost specific movies for tonight ("spotlight") without a filter form. The obvious first approach — give each spotlighted movie a flat multiplier (e.g. 3x its base weight) — has a hidden flaw: as more movies get spotlighted, they dilute each other's odds (spotlighting 1 of 10 pushes it to 25%, but spotlighting 5 of 10 only gets each to 15%), so the feature quietly feels weaker the more you use it, down to literally no effect if everything is spotlighted.

Decided instead: spotlighted movies as a group always get a fixed 70% combined win chance, split evenly among however many are spotlighted; non-spotlighted movies split the remaining 30%. This makes the effect strength independent of how many movies get starred — predictable and explainable in one sentence — while still degrading gracefully to plain equal odds when nothing is spotlighted (0 spotlighted = no group = default behavior, costs nothing when unused).

Considered options: flat per-movie multiplier (rejected — dilutes unpredictably as more items are selected); user-configurable weight sliders (rejected — reintroduces the "too filtery" complexity we were explicitly avoiding).
