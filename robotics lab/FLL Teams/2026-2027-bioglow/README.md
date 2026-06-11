# BIOGLOW FLL Team Hub

Season hub for AI Future FLL teams during the 2026-2027 BIOGLOW season.

BIOGLOW releases on August 4, 2026. The planning language in this hub is based on the public season preview: ecosystems, biodiversity, nature, technology, creativity, and innovation. Replace placeholder mission and judging details after official challenge materials are released.

## Local Routes

- Login: `/fll-hub/login`
- Coach hub: `/fll-hub`
- Student dashboard: `/fll-hub/student`

## Seed Accounts

These are starter accounts for local setup. Change or remove them before using the hub with real teams.

- Coach: username `coach`, password `bioglow2026`
- Student: username `student1`, password `student2026`
- Student: username `team1`, password `team2026`

Passwords are stored as salted scrypt hashes in `data/fll-users.json`.

## Updating The Hub

- Edit `data/announcements.json` for weekly reminders.
- Edit `data/timeline.json` for season phases and due dates.
- Edit `data/teams.json` for team status, current focus, next deliverable, and coach-only notes.
- Edit `data/assignments.json` for coach-pinned student assignments.
- Edit `data/tasks.json` for student-owned tasks.
- Edit `data/milestones.json` for read-only team progress checklists.
- Review `data/work-logs.json` for student lab/home updates.
- Duplicate `teams/_template` into `teams/team-02`, `teams/team-03`, and so on when new teams are added.

## Recommended Weekly Rhythm

1. Update each team's current focus and next deliverable.
2. Add one short announcement for the week.
3. Move the timeline current phase if the season has advanced.
4. Add coach notes in each team's Markdown files after practice.
5. Archive photos and documents in `media/` by date.
