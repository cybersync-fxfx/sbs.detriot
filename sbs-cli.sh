#!/bin/bash
# SBS Terminal App - Agent List

clear
echo -e "\e[1;36m=================================================\e[0m"
echo -e "\e[1;36m          DETROIT SBS - TERMINAL CLI             \e[0m"
echo -e "\e[1;36m=================================================\e[0m"
echo ""

# Fetch agents from the local SBS server
AGENTS_JSON=$(curl -s http://127.0.0.1:3001/api/internal/agents)

if [ -z "$AGENTS_JSON" ] || [ "$AGENTS_JSON" == "{}" ]; then
    echo -e "\e[1;33m[!] No agents currently connected to this Guard Server.\e[0m"
    echo ""
    exit 0
fi

# Count how many agents exist by parsing JSON keys length using node
AGENT_COUNT=$(echo "$AGENTS_JSON" | node -e "
const data = require('fs').readFileSync(0, 'utf-8');
if(data) {
  try {
    const obj = JSON.parse(data);
    console.log(Object.keys(obj).length);
  } catch(e) { console.log('0'); }
} else { console.log('0'); }
")

echo -e "\e[1;32m[+] Found $AGENT_COUNT connected agent(s):\e[0m"
echo ""

printf "\e[1;37m%-38s | %-16s | %-15s | %-15s\e[0m\n" "AGENT ID" "IP ADDRESS" "HOSTNAME" "OS"
printf "%-38s | %-16s | %-15s | %-15s\n" "--------------------------------------" "----------------" "---------------" "---------------"

# Parse and format JSON using Node (since Node is definitely installed for SBS)
echo "$AGENTS_JSON" | node -e "
const fs = require('fs');
const data = fs.readFileSync(0, 'utf-8');
if (!data) process.exit(0);

try {
  const agents = JSON.parse(data);
  if (agents.error) {
    console.error('Error fetching from server:', agents.error);
    process.exit(1);
  }
  
  Object.entries(agents).forEach(([id, a]) => {
      const ip = (a.ip || 'N/A');
      const host = (a.hostname || 'N/A').substring(0, 15);
      const os = (a.os || 'N/A').substring(0, 15);
      
      // Truncate agent ID if it's too long
      let displayId = id;
      if (displayId.length > 38) displayId = displayId.substring(0, 35) + '...';
      
      console.log(displayId.padEnd(38) + ' | ' + ip.padEnd(16) + ' | ' + host.padEnd(15) + ' | ' + os.padEnd(15));
  });
} catch(e) {
  console.error('Failed to parse agent data.');
}
"

echo ""
echo -e "\e[1;36m=================================================\e[0m"
echo ""
