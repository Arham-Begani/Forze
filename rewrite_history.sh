#!/bin/bash

# Delete old filter backups
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d

FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter '
    export GIT_AUTHOR_NAME="Arham-Begani"
    export GIT_AUTHOR_EMAIL="arhambegani2@gmail.com"
    export GIT_COMMITTER_NAME="Arham-Begani"
    export GIT_COMMITTER_EMAIL="arhambegani2@gmail.com"
' --msg-filter '
    python ./clean_msg.py
' --tag-name-filter cat -- --all
