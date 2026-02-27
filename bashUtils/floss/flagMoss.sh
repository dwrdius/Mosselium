#!/bin/bash

mossCCFile="flaggerUI.cc"
tempOutfile="flagbuilder.out"

if [[ ! -f "./${mossCCFile}" ]]; then
    echo "Could not find ${mossCCFile}"
    exit 1
fi

g++ "./${mossCCFile}" -o "moss.exe" || exit 1
# Generates 'mosslist.out', which will do actual stuff cuz bash has file perms
./moss.exe "./${tempOutfile}"
rval=$?

rm ./moss.exe
if [[ "${rval}" -ne 0 ]]; then
    rm "./${tempOutfile}"
    exit 1;
fi

bash "./${tempOutfile}"
rm "./${tempOutfile}"

# zip -r ./mossFiles.zip ./flagged/*
