Interactive terminal interface for selecting downloaded submissions from MOSS and converting them to grouped pdfs of C++ source file (.cc) and pdf versions (.pdf)

The assignment dropbox name needs to contain the downloaded submissions from the students and be discoverable with `find` \

Each username must exist as well or they will not be included in the group

flagged/ - output \
moss_output/ - contains directories that further contain a directory [question]/[user]/[code.cc] \

Usage:
- input question (and get confirmation)
- input all users in their groups
- groups are delimited with ';'
- users are delimited with '[ ,.]'
- Ex. `a3p1c user1, user2 user3.user4; user1    user7   ,.,.  `
