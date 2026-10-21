# Date review adjudication — main verification

Pinned review: reports/DATE_REVIEW_320edf3.md. Missing date-pair/repair-state finding remains valid; preserve inbound and mark awaiting_review/repair-needed rather than falsely configured snooze. The spring-gap validation finding is valid. The fall-back finding needs qualification, not blanket rejection.

Executed stdlib datetime + ZoneInfo('America/Toronto') round-trip:
- 2026-03-08T02:30:00-05:00 becomes 03:30-04:00: original wall and offset mismatch; reject nonexistent local time.
- 2026-11-01T01:30:00-04:00 round-trips identically (fold0).
- 2026-11-01T01:30:00-05:00 round-trips identically (fold1).

An explicit numeric offset matching the explicit IANA zone disambiguates a fall-back occurrence. Do not reject both valid offset-aware values merely because their naive wall time occurs twice. Require explicit disambiguation only where the input lacks it. Validate the ORIGINAL wall time and offset against the zone before canonical UTC normalization discards that information. Preserve ordinary/valid-fold positives, wrong-zone-offset and gap negatives, missing-pair recovery and read-only expiry invariants. Engineer was steered with this correction before final implementation.

This adjudication is not product acceptance or evidence that the candidate fix is implemented; final exact-head probes remain required.
