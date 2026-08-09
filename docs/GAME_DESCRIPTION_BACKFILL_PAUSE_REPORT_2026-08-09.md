# Talus game-description backfill pause report

Captured: August 9, 2026 (America/Chicago)

## Pause state

- The `backfill-game-descriptions` database schedule is removed and archived.
- The worker has a database-backed kill switch, so direct/manual POST requests also return a paused response.
- The active run is marked `paused`; its queue, attempts, and completed descriptions are preserved.
- News ingestion remains separately hard-frozen.

## Current run

| Status | Games |
| --- | ---: |
| Target | 542 |
| Succeeded | 317 |
| Failed | 154 |
| Queued | 71 |
| Processing | 0 |

The run is 87% processed if permanent failures are counted as processed, but only 58% of its target currently has a successful generated description. There are **225 unresolved games inside the run**: 154 failed plus 71 queued.

## Failure breakdown

| Cause | Games |
| --- | ---: |
| Description stayed outside the accepted word range | 151 |
| Other generation errors | 2 |
| Invalid JSON | 1 |

Quota errors are no longer included as permanent game failures. The dominant remaining engineering issue is the length-repair strategy: the model frequently returns fewer than 220 words even after two repair passes.

## Entire catalog

| Description state | Games |
| --- | ---: |
| Ready | 337 |
| Failed | 225 |
| Missing | 99 |
| Total | 661 |

The current run contains 542 games. Another **99 missing games were added outside that frozen run** and need to be included when a replacement/resume run is planned. Across the whole catalog, **324 games are not ready** (225 failed plus 99 missing).

## API usage observed since August 6

Game-description generation recorded:

- Draft: 624 calls; 515 succeeded and 109 failed.
- Editorial edit: 515 calls; 490 succeeded and 25 failed.
- Length repair: 911 calls; 896 succeeded and 15 failed.
- Total recorded description tokens: 1,287,177 input and 441,181 output.

The high length-repair volume is the clearest optimization target: 911 repair calls were made for 317 successful jobs, while 151 jobs still failed the final length gate.

## Recommended restart plan

1. Replace repeated free-form length repair with a deterministic acceptance strategy: accept strong descriptions above a lower practical floor, or request a bounded expansion that only adds a fixed number of grounded sentences.
2. Requeue the 154 failed jobs with preserved source facts after the length logic is changed.
3. Add the 99 newer missing games to the durable queue.
4. Resume with a one-game canary batch and verify output quality and token use before restoring three-game batches.
5. Keep quota/server failures deferred without consuming content-quality attempts.
