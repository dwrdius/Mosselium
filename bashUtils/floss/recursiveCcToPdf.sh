#!/bin/bash

for file in $( find -name "*.{cc,cpp}" -type f ); do
    directory=$(dirname "${file}")
    cd "${directory}/.."
    pwd
    parent=$(basename "${directory}")
    file=$(basename "${file}")
    output=$(echo "$file" | sed -e 's/\.cc$/.pdf/' -e 's/\.cpp$/.pdf/')
    output="${parent}/${output}"
    echo "${output}"
    enscript -Ecpp --color --line-numbers=1 -o - "${parent}/${file}" | ps2pdf - "${output}"
    cd -
    pwd
done