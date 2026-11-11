**FireSquire**

Pre-reboot health check for Unraid: a single verdict (All clear, Smouldering or The roof is on fire) before you reboot, so you never reboot into a known landmine.

Advisory only: it reads the host and reports. On the flash it writes an empty test file, which it deletes right away, and the CRC error count of each disk, so it notices when one rises. Adds a button next to Reboot on the Main tab, a flame icon next to Reboot on the Dashboard and a page under Settings → User Utilities.
