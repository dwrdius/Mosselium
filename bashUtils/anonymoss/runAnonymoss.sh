#!/bin/bash

anonCCFile="ccAnonymoss.cc"

basename="Anon"
outfile="anonSh.out"

usage() {
    echo "Usage: $0 [-b <basename>] [-o <outfile>]"
    echo
    echo "  -b <basename>  Set the base name for anonymized names (default is Anon)"
    echo "  -o <outfile>   Set the output file (default is anonSh.out)"
    echo "  -h             Show this help message"
    exit 1
}

while getopts "b:o:h" opt; do
    case $opt in
        b) basename="$OPTARG" ;;
        o) outfile="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
    esac
done

echo "Base name: $basename"
echo "Output file: $outfile"

if [[ ! -f "./${anonCCFile}" ]]; then
    echo "Could not find ${anonCCFile}"
    exit 1
fi

g++ "./${anonCCFile}" -o "anonSh.exe" || exit 1
startPath=$(pwd)
for file in './moss_output/'*; do
    if [[ -d "${file}" 
          && ( -f "${file}/readable.html" || -f "${file}/_readable.html") 
    ]]; then
        echo "${file}"
        cd "${file}"
        currPath=$(pwd)
        "${startPath}"/anonSh.exe "${outfile}" "${basename}"
        rval=$?
        if [[ "${rval}" -ne 0 ]]; then
            rm "${startPath}/anonSh.exe"
            rm "./${outfile}"
            exit 1;
        fi
        # cat "./${outfile}"
        bash "./${outfile}"
        rm "./${outfile}"
        cd -
    fi
done

rm "${startPath}/anonSh.exe"
