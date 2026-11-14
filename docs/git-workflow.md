# Git workflow

Each role works on its own long-lived branch, touches only its own folder, and merges into `main` through a pull
request. `main` is protected: it only accepts PRs (no approval required, so you can merge your own).

## First time
```bash
git clone https://github.com/joyaljaimon/homers-odyssey.git
cd homers-odyssey
git checkout role/<your-role>     # channel | brain | story | experience
npm install
cp .env.example .env              # fill in keys; never commit .env
```

## Every 2–3 hours
```bash
git add <your-folder>
git commit -m "brain: add highlight_passage tool"
git fetch origin
git rebase origin/main            # pick up everyone else's merged work
npm run typecheck
git push --force-with-lease
gh pr create --base main --head role/<your-role> --fill   # or open the PR on GitHub
```
Merge it once it's green. Small, frequent PRs keep four branches in sync.

## Rules
- Never commit API keys. Share them privately; put their names in `.env.example`.
- `contracts/` changes: announce in the team chat first, naming who's affected; bump `contract version`.
- Start commit messages with your folder: `channel:`, `brain:`, `story:`, `stage:`.
- If `main` breaks, whoever merged the break fixes it before anything else.
- After a PR merges, `git rebase origin/main` again before continuing.
