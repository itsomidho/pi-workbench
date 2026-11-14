#!/usr/bin/env python3
"""List commentable lines from a unified diff (stdin), e.g. `glab mr diff 12 --raw`.

Output, one per line:
  <new_path>:<new_line>  +  <code>     added line   -> --file <new_path> --line <new_line>
  <old_path>:<old_line>  -  <code>     removed line -> --file <new_path> --old-line <old_line>
Context lines are omitted; GitLab only reliably accepts comments on +/- lines.
Pass --files to print just the changed file paths with +/- counts.
"""
import re
import sys

hunk_re = re.compile(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@")
files_only = "--files" in sys.argv
old_path = new_path = None
old_no = new_no = 0
stats = {}

for raw in sys.stdin:
    line = raw.rstrip("\n")
    if line.startswith("diff --git "):
        old_path = new_path = None
        continue
    if line.startswith("--- "):
        p = line[4:].strip()
        old_path = None if p == "/dev/null" else p.removeprefix("a/")
        continue
    if line.startswith("+++ "):
        p = line[4:].strip()
        new_path = old_path if p == "/dev/null" else p.removeprefix("b/")
        stats.setdefault(new_path, [0, 0])
        continue
    m = hunk_re.match(line)
    if m:
        old_no, new_no = int(m.group(1)), int(m.group(2))
        continue
    if new_path is None or line.startswith("\\"):
        continue
    if line.startswith("+"):
        stats[new_path][0] += 1
        if not files_only:
            print(f"{new_path}:{new_no}\t+\t{line[1:]}")
        new_no += 1
    elif line.startswith("-"):
        stats[new_path][1] += 1
        if not files_only:
            print(f"{old_path}:{old_no}\t-\t{line[1:]}")
        old_no += 1
    else:
        old_no += 1
        new_no += 1

if files_only:
    for path, (add, rem) in stats.items():
        print(f"{path}\t+{add}\t-{rem}")
