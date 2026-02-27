#!/bin/bash

for file in $( find -name "*.cc" -type f ); do
    directory=$(dirname "${file}")
    cd "${directory}/.."
    pwd
    parent=$(basename "${directory}")
    file=$(basename "${file}")
    output=$(echo "$file" | sed 's/\.cc$/.pdf/')
    output="${parent}/${output}"
    echo "${output}"
    enscript -Ecpp --color --line-numbers=1 -o - "${parent}/${file}" | ps2pdf - "${output}"
    cd -
    pwd
done