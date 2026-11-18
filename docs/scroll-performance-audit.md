# Scroll and navigation investigation

## Scope and limits

The user reports weak scrolling and transitions across the app, particularly Android. The investigation below identifies and fixes two reproduced problems; it does not prove that all pages or all devices are smooth. Desktop Chromium with CPU throttling is a diagnostic approximation, not Android WebView, a GPU or 144 Hz hardware. A device's display and refresh configuration set an upper bound on its achievable rate. Exact Android root causes elsewhere remain unconfirmed until device traces and input tests are collected.

## Observed issue 1: unnecessary global rim work

`Boot` installs `useDarkRims`, which installs `observeRims` in the dark theme. The engine rasterizes opt-in `.sk-rim` and `.sk-rim-nested` canvases. Document-level capture listeners used to call `refresh()` for **every** `transitionend`, `transitioncancel`, `animationend` and `animationcancel`, even when the event target had no rim descendants. Each refresh revisited every tracked owner and its ancestors to calculate the invalidation key. Scrolling over interactive cards in the measured browser run produced many unrelated transitions, consuming main-thread time. In that trace, hadith-page transition-end/cancel handlers occupied approximately 960 ms cumulatively over the sample; this includes overhead and is not exclusive attribution or a device measurement.

The targeted change sends start/end/cancel work only to owners on or below the event target. Resize, mutation discovery, per-owner rasterization and theme cleanup remain unchanged. An ancestor's transform still updates its descendant rims. A dedicated browser test compares all output canvas pixels with the unchanged rasterizer, checks running ancestor animation, resize, dynamic discovery/removal and cleanup, and verifies 30 unrelated end events trigger no style reads. An isolated baseline/modified comparison also produced matching rim bitmaps for the initial, transformed and resized cases.

One run of Chromium (390×844, dark theme, 4× page-main-thread throttle, wheel script) had 95th percentile animation-frame callback gaps of 83.3 ms before and 50.0 ms after on the books screen, and 50.0 ms before and 33.4 ms after on the Quran screen. The script, tracing and system load affect the measurements; samples are not 144 Hz certification, and smoothness on real Android is unknown. There are still sources of work, including unrelated scripts, compositing and painting.

## Observed issue 2: long Azkar text

On the morning-azkar card at 30px text and a 390×560 viewport, a real touch gesture over scrollable text could both scroll the text and trigger the parent Motion vertical-drag navigation. The original text node became disconnected as the next item opened. A short drag could scroll without triggering navigation, so testing only that gesture would miss the problem.

The text area now stops pointer-down propagation **in capture only when it actually overflows**. Native scrolling remains on that area; card navigation on the rest of the card and normal click counting remain. Browser touch and wheel tests assert long-text movement, no unintended counter increment/navigation, a normal tap increment, and a separate touch swipe on the card navigating to the next item. Short text does not acquire a scroll range artificially. An additional probe found that swiping directly on short text did not navigate in the baseline either; this patch does not claim to fix that separate pre-existing behavior.

## Test instrumentation and known boundaries

- `scripts/scroll-audit.mjs` checks the listed flows; its fixed prayer-settings selector now matches the current close button. Its reciter-scroll input fixture blocks the live reciter API so that the application's own 114-surah fallback is used. Before this correction a live short recording had no scrolling range and was incorrectly counted as a scrolling failure. Real touch/wheel points are checked against the intended target.
- `scripts/test-scroll-input.mjs` uses actual simulated touch/wheel input at 390×560 on the reachable home, Quran reciters, hadith books, library overlay, azkar, long azkar text, names overlay, prayer settings and settings. It checks movement of the actual scroll owner, not just setting `scrollTop` after the gesture. The synthetic input, cached/network state and viewport are not a substitute for an installed Android app.
- `scripts/test-rim-invalidation.mjs` tests the independent rim engine in Chromium.
- Unchecked in this environment include the downloaded Quran reader, authenticated AI, real shared conversation, Android battery overlay and real-device WebView. Do not count them as tested or assert all paths are defect-free. The scroll-ownership audit enumerates additional conditional screens and limitations.
- A previous TypeScript error in `QuranMediaService.ts:91` is outside this change.

For field verification, install a release-equivalent APK on representative Android devices, capture WebView DevTools and Perfetto FrameTimeline traces for the actual problematic pages, record device model/WebView version/refresh rate, and repeat while audio, network requests and downloads are active. Test both themes, scroller ownership, gesture navigation and modal restoration. Investigate any remaining jank rather than assuming the two fixes address every cause.

References: [Android performance measurement](https://developer.android.com/topic/performance/measuring-performance), [Android slow rendering](https://developer.android.com/topic/performance/issues/render), [Chrome DevTools WebView debugging](https://developer.chrome.com/docs/devtools/remote-debugging/webviews), and [device emulation limitations](https://developer.chrome.com/docs/devtools/device-mode).
