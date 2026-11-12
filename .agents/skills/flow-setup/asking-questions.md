# Asking questions

How the three flow skills (`flow-setup`, `flow-backlog`, `flow-work`) ask the user. It lives here once, so the skills cannot drift apart. Read it before your first question.

## Ask everything in one round

- **Gather first.** Before asking anything, collect every open question you have at this point.
- **Ask the independent ones together**, in a single round. Never drip-feed them (ask one, wait, ask the next).
- **Ask one alone only when its answer changes the others.** Say that more questions follow.
- **Propose an answer for each question**, and put it first.
- **Skip what is already settled.** If the code, the task or an earlier answer settles a question beyond doubt, don't ask it: say what you assumed.

## How to present them

- **With a question tool that has selectable options** (for example `AskUserQuestion` in Claude Code): one selector per question, your proposed answer first, and the free-text option left open. If the tool takes fewer questions per call than you have, fill each call to its limit.
- **Without one**: a numbered list with your proposed answer for each, so the user can reply "OK" or correct only some by number.

Each question stands on its own: what is being decided and why it matters, the options with what each one means in practice, and your recommendation with its reason. Never refer to something the user has not seen in the same message.

After asking, stop and wait.

## Explain what is new or complex

If a question touches something not yet discussed in this session, or a concept that is hard to follow (an architectural pattern, a library, a trade-off with non-obvious consequences, a setting whose name does not explain it):

- Explain it in plain words, in two or three lines, right before the question.
- If a proper explanation would be longer than that, don't write it. Add "explain it first" as an option of that question, so the user can ask for the explanation before deciding.
