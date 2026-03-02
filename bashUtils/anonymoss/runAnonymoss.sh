#!/bin/bash

anonCCFile="ccAnonymoss.cc"

basename="Anon"
outfile="anonSh.sed"
verbose="false"

usage() {
    echo "Usage: $0 [-b <basename>] [-o <outfile>]"
    echo
    echo "  -b <basename>  Set the base name for anonymized names (default is Anon)"
    echo "  -o <outfile>   Set the output file (default is anonSh.out)"
    echo "  -h             Show this help message"
    exit 1
}

while getopts "b:o:vh" opt; do
    case $opt in
        b) basename="$OPTARG" ;;
        o) outfile="$OPTARG" ;;
        v) verbose="true" ;;
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
        echo "Anonymizing ${file}"
        cd "${file}"
        currPath=$(pwd)
        "${startPath}"/anonSh.exe "${outfile}" "${basename}"
        rval=$?
        if [[ "${rval}" -ne 0 ]]; then
            rm "${startPath}/anonSh.exe"
            rm "./${outfile}"
            exit 1;
        fi
        if [[ "${verbose}" == "true" ]]; then
            cat "./${outfile}"
        fi
        find . -type f -name "*.html" -exec sed -i -f "./${outfile}" {} + 
        rm "./${outfile}"
        cd - &> /dev/null
    fi
done

rm "${startPath}/anonSh.exe"
