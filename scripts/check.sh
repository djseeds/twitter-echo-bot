#!/usr/bin/env bash
for f in $(git ls-files | grep .js$)
do
    node -c $f
done

