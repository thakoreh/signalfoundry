# Decision providers

The product uses a replaceable decision boundary rather than coupling research and drafting to one model.

## Default: transparent rules

Rules evaluate available public evidence against the editable profile. Each score has an explanation and a visible contribution. They are deterministic and cost no inference fees. The UI must identify this engine as `rules`.

## Optional: Jev

Jev is TypeSafe's bounded decision model, not a text-generation model. Official documentation describes Choice, Score and Noul outputs. It is appropriate for criteria such as fit, evidence sufficiency and next-step routing; it should not write outreach emails or manufacture explanations.

The direct API contract was checked on September 30, 2026:

- `POST https://api.typesafe.ai/v1/systemone`
- Server-side bearer authentication
- Request includes `state`, `model` and predefined `questions`
- Pinned model at implementation time: `jev-1.13.0`
- Score returns a zero-based expected level and can be fractional
- Confidence is not the same as winning probability or a calibrated factual guarantee

The backend README and `.env.example` define the implemented opt-in switches. Missing configuration, unavailable service or invalid responses must produce a visibly attributed rules fallback, never a fake Jev success. Unit tests mock the vendor response. No live Jev request or paid call was made in this build.

Sources: https://docs.typesafe.ai/api and https://docs.typesafe.ai/models

## Future: OpenAI Decisions

OpenAI announced a finite-answer Decisions API in limited preview. A public implementation contract was not verified for this build, so the code exposes an extension boundary rather than inventing an endpoint. Do not silently route ordinary chat completions to it and label them Decisions.

Source: https://openai.com/index/devday-2026-recap/

## Evaluation before customers

Create a labeled set of real company/profile pairs with evidence snapshots. Measure fit precision and recall, insufficient-evidence handling, wrong-company failures, exclusion handling, score stability and cost. Version both profile criteria and provider model. A schema-constrained model can still make a wrong judgment.
