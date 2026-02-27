#include <iostream>
#include <fstream>
#include <unordered_map>
#include <cassert>

using namespace std;

string output = "anonysed.out";
string basename = "Anon";

int main(int argc, char* argv[]) {
    if (argc > 1) output = argv[1];
    if (argc > 2) basename = argv[2];

    ifstream fin("_readable.html");
    if (!fin) {
        cerr << "Could not find '_readable.html'... searching for 'readable.html'" << endl;
        fin = ifstream("readable.html");
        if (!fin) {
            cerr << "Please select a folder that contains a readable MOSS output." << endl;
            return EXIT_FAILURE;
        }
    }

    unordered_map<string,int> mp;
    int unique = 0;
    for (char c = ' '; fin >> c; ) {
        if (c == '.') {
            string s = "<";
            assert(fin >> s);
            // .html">username or .<p>...
            if (s[0] == '<') continue;
            assert(s.substr(0, 6) == "html\">");
            string username = s.substr(6);
            if (mp.find(username) == mp.end()) mp[username] = unique++;
        }
    }
    fin.close();

    ofstream fout(output);
    for (auto [s, i] : mp) {
        fout << "find . -type f -name \"*.html\" -exec sed -i"
             << " 's/" << s << "/" << basename << i << "/g' {} +" << endl;
             //   {s}/   {e}    /     {d          }     /g
    }
}
