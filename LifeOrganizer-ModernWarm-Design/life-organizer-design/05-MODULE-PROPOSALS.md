# Optional future chapters

These are product suggestions, not an approved backlog. Add one only if it fits how she actually wants to use the app. The design-only phase must not add tables, endpoints, background jobs, permissions, or fake navigation to unfinished screens.

## Recommended first three

| Module | Personal value | Smallest useful version | Access decisions | Relative scope |
| --- | --- | --- | --- | --- |
| Shopping together | A practical place to remember what one of you needs, including small thoughtful things. | One shared list; add/edit/check/delete an item; optional category and short note. | Both can add/check. Confirm whether both may permanently delete each other's items. | Small–medium: new domain CRUD; race/conflict handling; no store integration. |
| Our calendar | Keep dates that matter to the two of you in one calm place. | Shared events with title, start date/time, optional end, and note; agenda first. | Confirm shared vs private events, who can edit, and whether “private” is needed at all. | Medium: time zones, all-day events, edits, date navigation. Reminders add separate reliability work. |
| Little plans | A place for date ideas, places to visit, and small things to look forward to. | Idea title + note; Idea/Planned/Done; optional date; both contribute. | Confirm who may edit/delete; explicit action for converting a plan into a saved Memory. | Small–medium: simple new CRUD. Calendar integration is a later decision. |

### Shopping together concept

Use practical group headings such as Fresh, Pantry, Home. Completion is a clearly labelled check control. “Add an item” belongs at the bottom of the list or in a sheet. Empty state: “Nothing on the list. Add something when you think of it.”

Do not add barcode scanning, supermarket prices, recipe recommendation, automatic nutrition claims, or offline synchronization to the first version. These are independent product decisions.

### Our calendar concept

A compact selected week + a short agenda is more useful than shrinking a full month grid into the screen. Days have touch targets; tapping a date shows the corresponding agenda. Use real event timing rather than decoration.

No external calendar integration is necessary in the smallest version. If reminders are chosen, confirm timing, recipient preferences, and backend reliability; existing push limitations make a promised reminder guarantee inappropriate. Use Africa/Casablanca or device timezone deliberately, and store UTC instants for timed events. All-day dates are a separate model choice.

### Little plans concept

Use small idea cards, restrained tags, and ordinary status labels. Some ideas can be “For a quiet evening” without needing a date or priority score. A complete idea may later become a memory via an explicit composer step, not an automatic empty record.

Keep plans independent initially so the module is useful without calendar, maps, reservations, or recommendation services.

## Other ideas to consider later

| Idea | Why it might fit | Caution / decision before building |
| --- | --- | --- |
| Cozy recipes | Recipes you have tried or want to make together. | Start with personally added recipes; defer nutrition claims, shopping-list generation, and meal schedules. |
| Travel notebook | Places, itinerary notes, packing list for a shared trip. | Keep itinerary/planning distinct from memories; no booking/payment integration required. |
| A little pause | A small curated collection of encouraging text/audio for stressful moments. | Can begin as an extension of Notes rather than a whole module. Owner-curated content, no diagnosis or mood surveillance. |
| Milestones | Anniversaries and small moments worth remembering. | Often belongs in Our calendar + Memories; avoid duplicate modules. |
| Home reminders | Water plants, replace supplies, remember small shared tasks. | Only useful if you share those responsibilities; recurring reminders need reliable scheduling. |
| Budget and bills | Shared expenses if both genuinely want that. | Lower priority for this personal gift; consent, sensitive financial data, calculations, and permissions add scope. |

## Choosing what comes next

Start with Shopping together if practical shared use is the priority. Choose Little plans first if preserving the gift's emotional focus matters more. Choose Our calendar when dates and coordination are a real recurring need.

This is a product-fit judgment based on the supplied brief, not a claim about market demand or a fixed delivery estimate. Relative scope assumes the current modular-monolith approach and still needs source review.

Before approving any module, resolve: who creates/edits/deletes; whether content is shared or private; whether notifications are wanted; whether offline use is necessary; and which existing chapter can own the functionality more simply.

## Growth pattern

Keep only Home and Profile as permanent tabs. Chapters join a responsive Home collection. Show a useful description instead of requiring the user to decode a decorative icon. Once the collection grows, group chapters by purpose only if actual usage justifies it; avoid adding search and categories to a five-item hub.

Use a new frontend domain folder and backend domain package after scope approval. Share buttons/form controls, not domain-specific entities. Proposed new accents: shopping #426554 on #E8EFE9; calendar #3D5F7F on #E6EDF5; little plans uses the established rose. Confirm final contrast in the live app.
