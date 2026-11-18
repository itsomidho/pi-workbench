---
name: merge-request-review
description: Review a GitLab merge request in the WordPress projects (the configured repositories, or any repo with a file in $PI_STANDARDS_DIR/wordpress/projects/) across PHP, WordPress, Sage/Acorn, Gutenberg, JS, CSS and infra changes, and post the findings as inline MR comments via glab. Use when the user gives an MR number (e.g. "review MR 171", "/merge-request-review 171", "!171") or asks to review a GitLab merge request in these repos.
argument-hint: <mr-number> [project-name] [--dry-run]
allowed-tools: Bash(glab mr view:*), Bash(git remote get-url:*), Bash(glab mr diff:*), Bash(glab mr note list:*), Bash(git fetch:*), Bash(git show:*), Bash(git log:*), Bash(python3 $MR_HELPER:*), Read, Grep, Glob
---

# WordPress MR review (GitLab)

Arguments: the request supplied with this skill. The first number is the MR IID. An optional project name selects the repository. `--dry-run` means report only and post nothing.

Never modify the working tree: no `git checkout`, `git pull`, or `glab mr checkout`. Read MR code with `git show origin/<source_branch>:<path>`.

## 1. Resolve the project

Use the bundled startup procedure in `../../standards/README.md` relative to this skill. The local standards root defaults to `$HOME/.pi/standards` when PI_STANDARDS_DIR is unset. Each project has a private file in `$PI_STANDARDS_DIR/wordpress/projects/`: local path, GitLab path, first-party scope, text domains, PHP floors, and project facts. Project names are local configuration and are not bundled here.

- If the user named the repo, use it. Otherwise match the current directory's `git remote get-url origin` against the GitLab paths in those files.
- If neither gives a repo, ask which one.
- Read that project file now. Run every command below from its local path, so glab and git pick the right project.

To add a repo, copy a project file and fill it in. No other change is needed.

## 2. Gather the MR

Resolve `MR_HELPER` to the absolute path of `scripts/diff_lines.py` beside this SKILL.md, using the skill's actual loaded location. Do not resolve it from the application repository or assume PI_CONFIG_DIR is set. Then run the commands from the project's local repository path.

```bash
glab mr view <N> --output json      # title, description, source/target branch, author, diff_refs, labels
glab mr diff <N> --raw > "$SCRATCH/mr-<N>.diff"
python3 "$MR_HELPER" --files < "$SCRATCH/mr-<N>.diff"
python3 "$MR_HELPER" < "$SCRATCH/mr-<N>.diff"   # commentable lines
glab mr note list <N>               # existing discussions: don't repeat what's already said
git fetch origin <source_branch> <target_branch>
```

`$SCRATCH` is the session scratchpad directory.

`diff_lines.py` prints `path:line  +|-  code`. **Only those lines can take an inline comment.** `+` lines use `--line`; `-` lines use `--old-line`.

To read a whole changed file for context, use `git show origin/<source_branch>:<path>`. To read callers, hooks, or templates the change touches, use Read/Grep on the local checkout, but remember that checkout may not be on the MR branch.

If the MR state is not `opened`, or the diff is empty, report that and stop.

## 3. Scope: what to review

Review only the first-party paths listed in the project file. Skip everything in its "Skip" list.

You may *mention* a third-party plugin bump or add/remove in the summary, for example "ACF Pro replaced by SCF: check every `acf_*`/`get_field` call site still works". Do not line-comment inside it.

## 4. Load the checklists

Read `../../standards/checklists/INDEX.md` relative to this skill directory. Match the changed first-party files (from `diff_lines.py --files`) against its routing table and read **only** the checklists that match. `security.md` is always loaded.

The checklists are the review rules. The project file's "Project facts" override generic checklist advice where they conflict (for example, the Sage version or PHP floor of a specific component).

## 5. Review

Go through the diff file by file, applying the loaded checklists. For each candidate finding, read the full file at the source branch and any callers, templates or field definitions it affects, and keep it only if you can state the concrete failure. Follow the severity and precision rules in `INDEX.md`.

**Large MRs.** If the MR touches more than ~15 first-party files *and* at least three checklist groups (for example PHP/WordPress, front end, infra), you may split the review across parallel subagents, one per group. Give each: the diff path in `$SCRATCH`, the project file, the source branch name, its checklists, and the instruction to **return findings only** (`path:line`, side, severity, problem, failure scenario, fix) and never post or modify anything. Then merge the results, drop duplicates, and re-verify every finding yourself before step 6.

## 6. Present findings, then confirm before posting

Print the findings to the user, grouped:
- 🔴 Critical
- 🟡 Warning
- 🔵 Suggestion

Give each one as: `path:line` (with `+`/`-` side), a one-line problem, a short failure scenario, and a suggested fix.

Mark any finding whose line is **not** in `diff_lines.py` output as "summary-only". It goes in the overall note, not inline.

If `--dry-run`, stop here. Otherwise ask: **"Post these N inline comments + summary to !<N>?"** Let the user drop or edit items. Do not post without a yes.

## 7. Post to GitLab

Comment body format (Markdown). Use GitLab suggestion blocks only when the fix is a drop-in replacement for exactly the commented line(s):

````markdown
🔴 **Critical: Unescaped ACF value in output**

`get_field('cta_url')` is echoed raw into `href`; an editor-supplied `javascript:` URL executes on click.

```suggestion:-0+0
<a href="{{ esc_url(get_field('cta_url')) }}">
```
````

Comments are posted from the authenticated GitLab account after the user's approval; verify the intended account rather than assuming a bundled person's identity. Do not add any bot, AI, or "Claude" signature or footer to inline comments or the summary. Write in a direct, human reviewer voice.

Post every inline comment as a draft. Pass the body via a heredoc variable so quotes and backticks survive:

```bash
body=$(cat <<'MD'
...comment...
MD
)
glab mr note create <N> --draft --file "<new_path>" --line <new_line> -m "$body"   # prints the draft id
# removed line:  --file "<new_path>" --old-line <old_line>
# multi-line:    --line 10:15
```

`--draft` cannot be combined with `--unique` (glab rejects it). Avoid duplicates yourself instead, using the `glab mr note list` output from step 2.

Then add the summary as a draft too, and publish all the drafts together as one review:

```bash
glab mr note create <N> --draft -m "$summary"
glab mr note publish <N> --yes    # --yes is required when non-interactive
```

The summary contains:
- a one-paragraph overview of the MR;
- counts by severity;
- a label note if the MR has no type label, or one that clearly doesn't match the change (labels table in the project file); one line, not a finding;
- the summary-only findings;
- a verdict: ✅ safe to merge / ⚠️ merge after warnings / ⛔ blocked on criticals.

If an inline create fails (usually a line outside the diff), don't retry blindly. Re-check the line against `diff_lines.py` and either fix the number or move the finding to the summary.

Do not approve, merge, change labels, or resolve threads unless the user asks.

If asked to resolve threads, put the MR number first and use the **full** discussion ID: `glab mr note resolve <N> <discussion-id>`. glab reads an all-digit short prefix as a note number, so get full IDs from `glab api "projects/<url-encoded-path>/merge_requests/<N>/discussions?per_page=100"`.

Finish by telling the user:
- how many comments were posted;
- any that failed and why;
- the MR URL (`web_url` from step 2).
