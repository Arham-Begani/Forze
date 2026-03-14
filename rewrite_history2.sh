#!/bin/bash

# Remove Claude from Co-Authored-By
git filter-branch -f --env-filter '
    export GIT_AUTHOR_NAME="Arham-Begani"
    export GIT_AUTHOR_EMAIL="arhambegani2@gmail.com"
    export GIT_COMMITTER_NAME="Arham-Begani"
    export GIT_COMMITTER_EMAIL="arhambegani2@gmail.com"
' --msg-filter '
    sed -e "/Co-Authored-By: Claude/d"
' --tag-name-filter cat -- --all
