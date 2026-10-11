# Path of Ragnarok 1.2.1

**Fix: skill point exploit.** In 1.2.0 a character could take the ten skill point nodes, spend the points, then refund or reset the nodes and get all passive points back while keeping the skills. Now the skills stay paid for.

## Fixed

- Spending skill points **locks** that many Skill Point nodes and the chain of nodes that connects them to your start. Locked nodes cannot be refunded, are kept by **Reset all**, and are kept when you **load a saved build**.
- A skill point now exists only while its node is allocated (the "keep the best count ever" rule of 1.2.0 is gone). Refunding an unspent skill point node removes that point.
- Reset all only charges for the nodes it actually removes.

## Notes

- The nodes locked are the skill point nodes closest to your start, plus the nodes on the way to them. The server tells you when a refund is refused because of the lock.
- Characters that spent points in 1.2.0 without keeping the nodes: their learned skills stay, but they need to take skill point nodes again before they get any new points.
- Copy the mod folder over the installed one, press Apply and restart the client.
