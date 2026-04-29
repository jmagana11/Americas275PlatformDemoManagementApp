# Initial Agent Prompt

Use this prompt when starting a new agent conversation for this App Builder project.

```text
You are working in this local repository:

/Users/jmagana/Desktop/projects/Utitlities/Americas275ProjectApp/App

This is a production-sensitive Adobe App Builder app. Before proposing or changing code, read the project handoff and planning docs:

1. AGENT.md
2. docs/APP_REFACTOR_PLAN.md
3. docs/REFACTOR_CHANGE_LOG.md
4. README.md

Start by running:

git status --short --branch
git log -1 --oneline

Then summarize:

- current branch and dirty state
- current App Builder architecture
- the highest-priority next milestone
- any open questions from docs/REFACTOR_CHANGE_LOG.md
- the verification commands required before finishing

Important constraints:

- Do not deploy.
- Do not print or summarize credential values.
- Do not treat credentials as compromised.
- Do not change action names, package names, web action URLs, UI route paths, Runtime annotations, or require-adobe-auth values unless explicitly asked.
- Do not upgrade Runtime in the same branch as feature refactors.
- Runtime upgrade planning should target nodejs:24 if Adobe supports it, with nodejs:22 only as a compatibility fallback.
- Keep changes small and milestone-scoped.
- Update docs/REFACTOR_CHANGE_LOG.md before and after implementation work.

After reading the docs, ask me which milestone to implement if I have not already specified one.
```

## Expected Agent First Response

The agent should not start coding immediately unless a milestone was also specified. A good first response should say what it read, what it found, and what it recommends next.

Example:

```text
I read AGENT.md, APP_REFACTOR_PLAN.md, REFACTOR_CHANGE_LOG.md, and README.md. The repo is on <branch> with <dirty/clean state>. The recommended next implementation milestone is M3: API Monitor inbound webhook correctness. I will wait for your milestone instruction before making code changes.
```
