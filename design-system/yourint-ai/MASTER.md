# YourInt Research OS — Design System

**Product posture:** Evidence-led international growth research for teams. The interface should feel calm, exact, and trustworthy: closer to a professional research terminal than a generic AI dashboard.

## Design principles

1. **Evidence before decoration.** Show what Hermes checked, where a claim came from, and what remains uncertain.
2. **Progressive density.** Lead with the decision and reveal source detail on demand.
3. **Operational calm.** Use color for state and priority, not atmosphere.
4. **One clear action.** Every page has one visually dominant next step.
5. **Fast by default.** Prefer stable layouts, immediate feedback, skeletons, and restrained motion.

## Signature pattern: the evidence rail

Research activity is represented by a thin vertical rail with nodes for queued, browsing, extracting, verifying, and complete states. Each node can expose a timestamp, browser action, source URL, and status. Use this pattern in active runs, audit reports, and history detail.

## Color tokens

| Role | Light | Dark | Purpose |
|---|---:|---:|---|
| Canvas | `#F6F7F9` | `#09111F` | App background |
| Surface | `#FFFFFF` | `#101B2B` | Panels and navigation |
| Ink | `#101828` | `#F5F7FA` | Primary text |
| Muted ink | `#667085` | `#98A6BA` | Supporting text |
| Border | `#E4E7EC` | `#26354B` | Structure |
| Evidence blue | `#175CD3` | `#5B9CFF` | Primary actions and links |
| Verification teal | `#087E8B` | `#43C6C8` | Verified and completed |
| Warning amber | `#B54708` | `#FDBA74` | Attention and partial evidence |
| Destructive | `#B42318` | `#FDA29B` | Failure and destructive actions |

No purple/pink “AI” gradients. Avoid decorative gradients, excessive glass, and colored card backgrounds. State tints must remain subtle.

## Typography

- **UI and headings:** Manrope, 400–700.
- **Evidence metadata:** IBM Plex Mono, 400–500.
- Page titles: 30–36px, 700, tight tracking.
- Section titles: 18px, 650–700.
- Body: 14–16px with 1.5 line height.
- Labels: 11–12px, 650, uppercase only for short eyebrows.
- URLs, timestamps, IDs, and quantitative values use the mono face selectively.

## Shape, spacing, and depth

- 4px base spacing; primary rhythm is 8px.
- Controls have a 44px minimum target.
- Controls: 8px radius. Panels: 12px radius. Pills only for statuses.
- Panels use a one-pixel border and at most a subtle `0 1px 2px` shadow.
- Overlays may use deeper shadow. Do not lift every card on hover.
- Desktop page width: 1440px maximum with 28–40px gutters.

## Application shell

- Desktop: fixed 248px navigation rail with brand, primary research action, grouped navigation, and workspace footer.
- Mobile: 56px header plus five-item bottom navigation; secondary destinations live in a drawer.
- The active route uses a two-pixel evidence-blue marker, quiet fill, and strong text.
- Main content includes a visible-on-focus skip link and a focusable `main` landmark.

## Core components

### Buttons

- Primary is solid evidence blue.
- Secondary is a bordered surface.
- Ghost is reserved for low-priority utilities.
- Destructive actions never share the primary color.
- Press state scales to `0.98`; motion is 140–180ms.

### Panels

- Group related information with bands and dividers rather than a grid of interchangeable cards.
- Keep summary metrics in one coherent strip when they describe the same system.
- Empty states explain the value of the next action.

### Tables

- Sticky or persistent headers where useful.
- Name/title is the dominant column; IDs, URLs, and dates are quieter.
- On small screens, expose compact records or horizontal overflow with a visible cue.
- Bulk action bars appear near the selection context.

### Status

- Queued: neutral slate.
- Browsing/processing: evidence blue.
- Verified/completed: verification teal.
- Partial: amber.
- Failed: destructive red.
- Never rely on color alone; pair with text and an icon or shape.

## Motion and accessibility

- Interaction feedback: 140–180ms. Overlays: no more than 220ms.
- Animate opacity and transform only; avoid bouncing and decorative page transitions.
- Honor `prefers-reduced-motion`.
- Maintain WCAG AA contrast, visible focus rings, keyboard access, semantic labels, and logical heading order.
- Do not place critical information exclusively in a tooltip.

## Voice

Precise, calm, and direct. Prefer “Hermes is verifying pricing claims” to “AI magic is happening.” Use “research,” “evidence,” “sources,” and “findings” consistently.
