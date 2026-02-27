MOSS Output anonymizing tool.

Converts all usernames in readable MOSS output to anonymized usernames with the root name specified (Anon by default)

Usage: \
bash runAnonymoss.sh

Example: \
```html
<!--Before-->
<tr><td><a href="match0.html">user1 (52%)</a>
    <td><a href="match0.html">user2 (52%)</a>
<td align="right">92<td>bothcurrent,
<tr><td><a href="match1.html">user3 (37%)</a>
    <td><a href="match1.html">user4 (42%)</a>
<td align="right">92<td>bothcurrent,

<!--After-->
<tr><td><a href="match0.html">Anon0 (52%)</a>
    <td><a href="match0.html">Anon1 (52%)</a>
<td align="right">92<td>bothcurrent,
<tr><td><a href="match1.html">Anon2 (37%)</a>
    <td><a href="match1.html">Anon1 (42%)</a>
<td align="right">92<td>bothcurrent,
```
