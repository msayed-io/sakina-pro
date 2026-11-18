# Performance investigation: navigation and background work

## Scope and evidence

The app uses Capacitor's Android WebView, so WebView JavaScript, rendering, Android native work and network activity must be measured separately. A Chromium desktop test is useful for finding a reproducible browser bottleneck but is not a device benchmark. No claim here establishes a particular FPS, battery cost, memory use or Android WebView performance on real hardware.

Official guidance reviewed:

- Android on [measuring startup and jank](https://developer.android.com/topic/performance/measuring-performance), [slow rendering](https://developer.android.com/topic/performance/issues/render) and [diagnosing ANRs](https://developer.android.com/topic/performance/anrs/diagnose-and-fix-anrs): identify the blocking thread and costly frames before changing code; use system traces and device benchmarks, not a generic animation toggle. Frame budgets depend on the device refresh rate.
- Android's [background data-transfer options](https://developer.android.com/develop/background-work/background-tasks/data-transfer-options): select persistent, user-initiated and deferrable work appropriately. A JavaScript worker is in-process, not a replacement for a persistent OS job. Android's [DownloadManager security guidance](https://developer.android.com/privacy-and-security/risks/unsafe-download-manager) also advises care when considering that API.
- Google web.dev on [long tasks](https://web.dev/articles/optimize-long-tasks), [script evaluation](https://web.dev/articles/script-evaluation-and-long-tasks) and [workers](https://web.dev/articles/off-main-thread): async alone does not move JavaScript execution to another thread; reduce work or move appropriate work off the main thread, allowing for transfer, memory and CPU trade-offs. Workers cannot manipulate the DOM.
- Apple on [analyzing hangs](https://developer.apple.com/videos/play/wwdc2023/10248/) and [profiling, fixing and verifying responsiveness](https://developer.apple.com/videos/play/wwdc2026/268/): distinguish a busy main thread from one blocked on another resource and re-profile after changes. This is general diagnostic guidance, not evidence that this project has been tested on iOS.
- Chrome on [remote debugging WebViews](https://developer.chrome.com/docs/devtools/remote-debugging/webviews) and [device emulation limitations](https://developer.chrome.com/docs/devtools/device-mode): inspect a debug-enabled WebView on real hardware. Do not enable WebView inspection in a release solely for testing.
- Android's [baseline-profile benchmark documentation](https://developer.android.com/topic/performance/baselineprofiles/measure-baselineprofile): benchmark before/after on actual devices; a native ART profile is not a substitute for profiling JavaScript in a WebView.

## Findings and implemented changes

1. The downloaded Bukhari JSON used in the investigation was about 9 MB with 7,589 records. Before this change, its parsing, Arabic normalization/indexing and offline search loop ran in the UI's JavaScript context despite async function signatures. In one isolated Chromium test at 4x main-thread CPU throttling, indexing produced long tasks of roughly 285 ms and 986 ms; four searches each showed a 230–322 ms long task. This is one reproducible lab observation, not field telemetry.
2. A dedicated module worker now performs that existing indexing and search implementation, including its database access, and sends progress and at most 100 search results back. The core algorithm is unchanged. A startup handshake verifies worker-side IndexedDB; an unavailable/failed worker before a job starts uses the previous main-thread implementation. An error after a job starts is reported and is not automatically retried, to avoid duplicate writes. A new worker is terminated after each job. This cannot guarantee zero UI jank: CPU, memory, storage and networking remain shared resources; other code can still block the UI. The compatibility fallback can still block the UI.
3. `AuthenticatedApp` updates its clock every second. Development-only render counting showed the mounted hadith screen re-rendering repeatedly while visible and also while hidden; the original other main tabs were already memoized. Memoizing this screen and stabilizing its library callback prevented those clock-driven renders in the isolated check, without unmounting it or suppressing its own state changes.

In a comparable isolated Chromium test after the worker change, no >50 ms main-thread long task was reported during the individual indexing/search intervals. The source dataset hash, progress sequence and four search-result hashes matched the baseline. The CPU throttle attached to the page does not necessarily throttle worker threads equally, so elapsed times before/after should not be interpreted as a fair speedup or Android result.

## Reproduction and regression checks

Build Android web assets or the web production build, serve `dist`, then run:

```sh
SAKINA_TEST_URL=http://127.0.0.1:3011 HADITH_TEST_FIXTURE=/path/to/ara-bukhari.min.json node scripts/test-hadith-background.cjs
SAKINA_TEST_URL=http://127.0.0.1:3011 node scripts/test-android-navigation.cjs
SAKINA_TEST_URL=http://127.0.0.1:3011 node scripts/test-hadith-share-export.cjs
```

The fixture must be the unmodified upstream Bukhari edition; without it the background test uses the original download URLs. The test exercises worker, unavailable-worker and failed-worker-start paths, navigates during indexing, checks the complete persisted data hash and runs offline search. A separate failure injection confirmed that a worker error after job start is propagated rather than retried. A build-size warning remains; `tsc --noEmit` still reports the pre-existing `QuranMediaService.ts:91` signature error.

## What remains to validate

- On representative low-end and mid-range Android devices, install a release-equivalent build, test cold/warm navigation, long scrolling, concurrent audio and downloads, background/foreground transitions, Worker + IndexedDB support, offline operation and storage pressure. Record WebView version, refresh rate, frame timings, input latency, peak memory, battery and thermal conditions. Repeat before/after under equivalent network/cache conditions.
- Use Android Studio/Perfetto and a debug-only WebView inspection session to distinguish WebView main-thread tasks, native work and GPU rendering. Include interrupted downloads and repeated searches, and observe the worker fallback path. Do not assert that the existing WebView download completes after process death.
- The app still has other potentially expensive paths, including loading large offline books into the UI and fetching/parsing other content. They need their own traces and content-integrity tests before changes; this patch does not make all background work nonblocking.
