#include <iostream>
#include <vector>
#include <filesystem>
#include <fstream>

using namespace std;

const char GROUP_DELIM = ';';
const vector<char> USER_DELIM = {',', ' ', '.'};
const string DEFAULT_OUTPUT_FILE = "mosslist.out";

string getPath(const string& name) {
    for (const auto& entry : std::filesystem::recursive_directory_iterator("./moss_output/")) {
        if (entry.is_directory() &&
            entry.path().filename() == name) 
            return entry.path().string();
    }
    return "";
}

string getPath(const string& name, const string& parent) {
    for (const auto& entry : std::filesystem::recursive_directory_iterator(getPath(parent))) {
        if (entry.is_directory() &&
            entry.path().filename() == name) 
            return entry.path().string();
    }
    return "";
}

bool directoryExists(const string& name) {
    return !getPath(name).empty();
}

bool isUserDelim(char c) {
    for (char c2 : USER_DELIM) if (c == c2) return true;
    return false;
}

void splitUsers(string& s, vector<vector<string>>& groups) {
    groups.push_back({});
    vector<string>& res = groups.back();
    int n = s.size();
    for (int i = 0; i < n; i++) {
        while (i < n && isUserDelim(s[i])) i++;
        string user = "";
        while (i < n && !isUserDelim(s[i])) {
            user += s[i];
            i++;
        }
        if (!user.empty()) {
            if (directoryExists(user)) {
                cout << "Adding user: " << user << endl;
                res.push_back(user);
            }
            else {
                cout << "Ignoring user: " << user << endl;
            }
        }
    }
    if (groups.back().empty()) groups.pop_back();
}

void tokenLower(string& s) {
    for (char& c : s) {
        if ('A' <= c && c <= 'Z') c += 'a' - 'A';
    }
}

int main(int argc, char * argv[]) {
    string outputFilename = DEFAULT_OUTPUT_FILE;
    if (argc == 2) {
        outputFilename = argv[1];
    }

    ofstream fout(outputFilename);
    if (!fout) {
        cerr << "Failed to create output file." << endl;
        return EXIT_FAILURE;
    }
    
    fout << "echo 'mosslist init'" << endl;
    fout << "mkdir -p ./flagged\n"; 
    fout << "rm -r ./flagged/*" << "\n";
    fout << "touch ./flagged/.gitkeep" << "\n";
    fout << "cp ./recursiveCcToPdf.sh ./flagged\n";

    vector<string> questions{};
    string token;
    cout << "Input question then usernames in groups (delimited by";
    for (char c : USER_DELIM) cout << "'" << c << "',";
    cout << ") and delimit the groups by '" << GROUP_DELIM << "'\n";
    cout << "Indicate completion with 'done' or 'q'" << endl;
    while (!cin.fail()) {
        string question = "";
        string group = "";
        vector<vector<string>> groups {};
        cout << "Questions so far: ";
        for (string& s : questions) cout << s << ", ";
        cout << endl;
        cout << "Enter a question name (must match Moss)" << endl;
        while (cin >> token) {
            tokenLower(token);
            if (token == "done" || token == "q") break;
    
            if (question.empty()) {
                bool isDuplicate = false;
                for (string& s : questions) {
                    if (s == token) {
                        cout << "Duplicate question name" << endl;
                        isDuplicate = true;
                        break;
                    }
                }
                if (isDuplicate) break;

                cout << "Question Name: " << token;
                if (directoryExists(token)) {
                    cout << "... found" << endl;
                    question = token;
                }
                else {
                    cout << "... not found" << endl;
                }
            }
            else {
                group += " ";
                for (char c : token) {
                    if (c != GROUP_DELIM) group += c;
                    else {
                        splitUsers(group, groups);
                        group.clear();
                    }
                }
            }
        }
        splitUsers(group, groups);
    
        if (groups.empty()) continue;

        int i = 0;
        cout << endl << "groups: " << endl;
        for (auto& v : groups) {
            cout << i << ": ";
            for (auto x : v) cout << x << " ";
            cout << endl;
            i++;
        }
    
        cout << "Confirm adding this question to flagged output? (y/n)" << endl;
        if (cin >> token) {
            tokenLower(token);
            if (token == "yes" || token == "y") {
                questions.push_back(question);
                for (int i = 0; i < groups.size(); i++) {
                    string dir = "./flagged/" + question + "/Group_" + to_string(i);
                    fout << "mkdir -p " << dir << "\n";
                    for (auto& user : groups[i]) {
                        fout << "cp -r " << getPath(user, question) << " " << dir << "\n";
                    }
                }
            }
            else break;
        }

        cout << "Continue with another question? (y/n) " << endl;
        token = "q";
        cin >> token;
        tokenLower(token);
        if (token == "quit" || token == "q" || token == "no" || token == "n") break;
        system("clear");
    }
    
    fout << "cd ./flagged\n";
    fout << "bash ./recursiveCcToPdf.sh\n";
    fout << "cd ../" << endl;

    fout.close();
    
    return questions.empty();
}