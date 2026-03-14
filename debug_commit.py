import subprocess

def get_commit_info(rev):
    res = subprocess.run(['git', 'cat-file', '-p', rev], capture_output=True, text=True)
    print(f"--- Raw Commit {rev} ---")
    for i, line in enumerate(res.stdout.splitlines()):
        print(f"LINE {i}: {line}")

get_commit_info('c4ebd0e')
