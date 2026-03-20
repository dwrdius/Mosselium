#!/bin/bash

mossCCFile="flaggerUI.cc"
tempOutfile="flagbuilder.out"

keepFlagBuilder=false

while getopts "k" opt; do
    case $opt in
        k) keepFlagBuilder=true ;;
        *) echo 'Use -k to keep the flagging file' ;;
    esac
done

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

if [[ "${keepFlagBuilder}" = "false" ]]; then
    rm "./${tempOutfile}"
fi

# zip -r ./mossFiles.zip ./flagged/*
