# Design QA — Timeline Segmented Rail

Date: 10 November 2026

Source visual truth: `C:\Users\2994\.codex\generated_images\01a12f9d-cb8a-70a3-9caf-a123925efce9\exec-27fdc600-18cb-4478-ab92-2b52ed45edcc.png`

Implementation: `http://127.0.0.1:4190/?view=timeline#dashboard-app`

Combined comparison: `http://127.0.0.1:4190/design-qa-timeline.html`

Comparison assets: `dist/design-qa-timeline.html` and `dist/assets/timeline-option-1-reference.png`

Viewport: desktop 1488 × 1058 CSS px, device scale factor 1. The source and live implementation were normalized to the same 1488 × 1058 frame in the combined comparison.

Pixel dimensions: source 1488 × 1058; implementation viewport 1488 × 1058; comparison viewport 1488 × 1058.

State: Timeline tab active, current date 10 November 2026, latest bundled project data loaded, no editor modal or project drawer open.

## Findings

- No actionable P0, P1, or P2 differences remain.
- The implementation preserves the selected direction: one straight line per project, teal completed segments, blue double-ring active nodes, hollow upcoming nodes, alternating activity labels, start-date chips, deadline chips, and a compact status legend.
- Dynamic content intentionally differs from the illustrative source: all 18 real projects and their current activities, statuses, urgency levels, start dates, and deadlines are rendered instead of the eight sample rows.

## Required fidelity surfaces

- Fonts and typography: Segoe UI remains the global family; project labels, milestone labels, legend text, weights, and truncation remain readable at the selected 85% desktop density.
- Spacing and layout rhythm: column order, compact row height, endpoint spacing, alternating milestone labels, and timeline rail alignment follow the selected mock. The panel is normalized to the visible desktop width so the Deadline column is not clipped.
- Colors and visual tokens: forest teal maps completed work, slate blue maps active work, pale gray maps upcoming work, muted sand maps deadlines, and coral is reserved for overdue states.
- Image quality and asset fidelity: the selected concept contains no raster content requiring recreation. Existing Material Symbols are reused for calendar, flag, check, and legend icons; no placeholder imagery was introduced.
- Copy and content: fixed labels match the selected direction. Project content remains sourced from the application’s latest data rather than the mock’s illustrative sample data.

## Focused region comparison

The combined comparison page places the source and live implementation in equal-size frames. The timeline header, first eight project rows, node states, alternating labels, start chips, and deadline chips remain legible in that single comparison view, so no additional crop was required.

## Comparison history

1. Initial implementation: one P2 layout issue was found because the app’s global 85% desktop scaling placed the Deadline column outside the visible Timeline panel.
2. Fix applied: the desktop Timeline panel width was normalized against the existing zoom factor, keeping the long rail while bringing the Deadline column and legend into view.
3. Post-fix evidence: the combined comparison shows the complete line, start and deadline endpoints, state legend, and all columns within the desktop frame.

## Functional checks

- Board, Timeline, Report, and Archive navigation remain intact.
- Timeline search tested: “UAT #5” reduced the list to one project, and clearing the field restored all 18 projects.
- Timeline route and workspace tab open the correct state.
- Latest project data continues to drive milestone labels and statuses.
- Main application console errors: none.
- JavaScript syntax validation: passed.

## Follow-up polish

- P3: dense projects with more than ten activities necessarily use smaller labels than the illustrative mock; the alternating placement and native title tooltip keep them usable without increasing row height.

final result: passed
