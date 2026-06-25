# AI Future Camp Lesson Deck Guide

This project contains teacher-ready HTML lesson decks for LEGO Technic / SPIKE Prime summer camp lessons. The goal is to keep every lesson cohesive: same visual language, same classroom rhythm, same slide controls, and a light BioGlow mission story that supports the engineering challenge.

## Current Structure

- `index.html` is the teacher home page. It should stay the main entry point for all weeks.
- Each lesson lives in its own folder, such as `Lesson 1`, `Lesson 2`, etc.
- Polished decks use editable HTML, CSS, and JavaScript.
- Week 1 also includes original PDFs and extracted original-slide images. Week 2 currently uses editable HTML-only slides because no Week 2 PDFs were provided.
- Do not edit old/base64/legacy files unless there is a specific reason. Continue updating the polished lesson deck files.

## Lesson Deck Pattern

Use this rhythm for new lessons:

1. Title / lesson intro
2. Quick review of the previous lesson
3. Today's goal or lesson goal
4. Key vocabulary or engineering concept
5. LEGO building tips or Technic construction advice
6. Build checkpoint or practical design check
7. BioGlow mission story slide
8. Challenge rules
9. Fair testing rules
10. Improve your design / iteration prompt
11. Reflection questions
12. Quick lesson flow for the teacher

When original PDF slides exist, place them near the matching concept or challenge section. Use editable HTML slides to bridge gaps, add teacher prompts, and make the lesson more classroom-ready.

## Visual Foundation

Keep the Week 1 look:

- Blue background with dark blue accents and yellow badges.
- Full-screen horizontal slides, one slide per viewport.
- Cards with strong borders, subtle shadows, and clear headings.
- Consistent classes such as `slide`, `badge`, `big-card`, `card`, `grid-2`, `grid-3`, `teacher-note`, `rule`, `icon`, and `question`.
- Slide navigation in the bottom-right corner with previous/next buttons and a slide counter.
- A `Home` button in the slide navigation that links back to `../index.html`.
- Keyboard support for left/right arrows, PageUp/PageDown, Home, and End.

Slides should not scroll vertically during teaching. Fit content to the screen with responsive CSS instead.

## Content Style

Each lesson should feel practical, not like a marketing page. Keep the first slide focused on the actual activity. Use short, student-friendly language and make every slide useful for teaching.

Good lesson language:

- "Today I will..."
- "Build check..."
- "Technic tips..."
- "Challenge rules..."
- "Change one thing and test again..."
- "What helped? What made it harder?"

Avoid adding long explanations, decorative filler, or extra story that replaces the engineering task.

## BioGlow Mission Convention

BioGlow is a light mission world, not a full science unit. Use it to give students a reason for the build.

Each lesson should have one clear BioGlow mission slide:

- Mission title
- Short story context
- Direct connection to the engineering challenge
- Teacher mission prompt

Examples:

- Tower: build a signal tower.
- Bridge: cross a glow stream.
- Balloon car: power a rover.
- Catapult: launch a glow marker.
- Rubber band car: run an elastic rover.
- Elevator: raise a supply crate.
- Ferris wheel: rotate an observation wheel.
- Marble run: move glow samples.

## Challenge And Testing Rules

Every challenge should define:

- What students build
- What counts as success
- How many trials teams get
- How measurement happens
- What stays the same for fairness
- What students may change during iteration

Use fair testing language often:

- Same start
- Same load
- Same surface
- Same marble/projectile/object
- One design change at a time
- Record results before improving

## Responsive And Navigation Requirements

Before considering a deck finished, verify:

- The home page opens the lesson.
- The lesson's Home button returns to `index.html`.
- The slide counter shows the correct slide count.
- Left/right arrow keys move forward and backward.
- On-screen previous/next buttons work.
- Slides fit without vertical overflow at:
  - Current in-app browser size
  - `1280x800`
  - `1920x1080`
- Images or diagrams are not cropped or spilling off-screen.

For original slide images, use containment rules such as `object-fit: contain` and max-height based on the viewport.

## Home Page Rules

Keep `index.html` organized by week:

- Week 1 Foundations
- Week 2 Engineering Challenges
- Future weeks should be added as their own sections.

Each lesson card should include:

- Lesson number
- Lesson title
- One short summary sentence
- 3 topic bullets
- Open Lesson button
- Original PDF button only when a real PDF exists

Do not remove existing working lesson links when adding new weeks.

## Naming Conventions

Use continuous lesson numbering:

- `Lesson 1`, `Lesson 2`, etc.
- Main polished deck filenames should be descriptive and lowercase-ish, such as:
  - `lesson5_rubber_band_car.html`
  - `lesson6_elevator_lift.html`
  - `lesson7_ferris_wheel.html`

If assets are needed, create a matching assets folder:

- `lesson5_assets`
- `lesson6_assets`

## Future Lesson Checklist

Before building a new lesson:

- Identify the lesson topic and engineering challenge.
- Decide whether source PDFs/images exist.
- Copy the current deck structure and navigation behavior.
- Add one BioGlow mission slide.
- Add one LEGO building tips slide before the build check.
- Add challenge rules, fair testing, iteration, reflection, and teacher flow.
- Update `index.html`.
- Verify slide fit and navigation in the browser.

This README should be updated whenever the lesson structure changes so future decks stay consistent.
