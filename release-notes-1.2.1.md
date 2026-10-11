# Path of Ragnarok 1.2.1

**Fix: skill point exploit.** In 1.2.0 a character could take the ten skill point nodes, spend the points, then refund or reset the nodes and get all passive points back while keeping the skills. Now the skills go with the nodes.

## Fixed

- A skill point exists only while its node is allocated. If fewer skill point nodes are allocated than points were spent (a node refunded, **Reset all**, a saved build loaded with fewer of them, a change of start class), **all learned skills are reset**: every learned skill is taken back, a level you had from your class before is restored, and the points are given back to spend anew.
- The server asks for a repeat before it happens: refunding such a node, **Reset all** and **Load build** answer with a warning ("... resets your learned skills ... again to confirm") and do it on the repeat. The Reset all button names the skill reset in its confirm text. The chat shows a line when a reset happens.
- Reset all only charges for the nodes it removes (as before).

## Notes

- Your learned skills are only touched when the points you hold drop below the points you spent. Unspent points can be taken back freely.
- Characters that spent points in 1.2.0 and no longer have the nodes get their skills reset at the next login.
- Lowering the setting "Most skill points" below the points a character spent resets that character's skills too (0 = switched off leaves skills alone).
- Copy the mod folder over the installed one, press Apply and restart the client.
