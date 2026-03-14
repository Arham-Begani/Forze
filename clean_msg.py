import sys
import re

msg = sys.stdin.read()

# Pattern 1: Multi-line wrapped version
# Co-Authored-By: Claude
# Opus 4.6
# <noreply@anthropic.com>
msg = re.sub(r'Co-Authored-By: Claude\s*\n\s*Opus 4\.6\s*\n\s*<noreply@anthropic\.com>', '', msg, flags=re.IGNORECASE)

# Pattern 2: Single line version
msg = re.sub(r'Co-Authored-By: Claude.*<noreply@anthropic\.com>', '', msg, flags=re.IGNORECASE)

# Pattern 3: Any line containing noreply@anthropic.com (just in case)
msg = re.sub(r'(?i)^.*noreply@anthropic\.com.*\n?', '', msg, flags=re.MULTILINE)

# Pattern 4: Any line that is JUST "Co-Authored-By: Claude" (if it got orphaned)
msg = re.sub(r'(?i)^.*Co-Authored-By:\s*Claude.*\n?', '', msg, flags=re.MULTILINE)

# Pattern 5: Any line that is JUST "Opus 4.6" (if it got orphaned)
msg = re.sub(r'(?i)^.*Opus 4\.6.*\n?', '', msg, flags=re.MULTILINE)

# Cleanup trailing whitespace
msg = msg.strip()

sys.stdout.write(msg)
