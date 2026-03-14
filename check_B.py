import sys

with open("commit_B.txt", "rb") as f:
    content = f.read()

print(repr(content))
