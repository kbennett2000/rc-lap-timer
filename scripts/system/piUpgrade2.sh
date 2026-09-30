#!/bin/bash
set -euo pipefail

# Start the timer
start_time=$(date +%s)

# Function to prompt the user
prompt_user() {
  echo "UpgrayeDD wants to know, do you want to reboot or shutdown? (r for reboot / s for shutdown) - A pimp's gotta choose!"
  echo "You have 15 seconds to choose, otherwise UpgrayeDD will reboot your ass..."
  curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=reboot%20or%20shutdown" 2>/dev/null || true
}

# Set a timeout for the user's input
read_user_input() {
  choice=""
  read -r -t 15 -p "Choose wisely: " choice || true
}

# Function to handle the user's choice
handle_choice() {
  case $choice in
    r|R)
      echo "UpgrayeDD is rebooting the system..."
      curl -s -o /dev/null "http://192.168.4.99/rgb?r=25&g=25&b=25" 2>/dev/null || true
      curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=rebooting" 2>/dev/null || true
      curl -s -o /dev/null "http://192.168.4.99/pattern?name=upgrayedd" 2>/dev/null || true
      sudo reboot now
      ;;
    s|S)
      echo "UpgrayeDD is shutting down the system..."
      curl -s -o /dev/null "http://192.168.4.99/rgb?r=25&g=25&b=25" 2>/dev/null || true
      curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=shutting%20down" 2>/dev/null || true
      curl -s -o /dev/null "http://192.168.4.99/pattern?name=upgrayedd" 2>/dev/null || true
      sudo shutdown now
      ;;
    *)
      echo "UpgrayeDD didn't hear shit from you. Rebooting by default..."
      curl -s -o /dev/null "http://192.168.4.99/rgb?r=25&g=25&b=25" 2>/dev/null || true
      curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=tired%20of%20waitig%20rebooting" 2>/dev/null || true
      curl -s -o /dev/null "http://192.168.4.99/pattern?name=upgrayedd" 2>/dev/null || true
      sudo reboot now
      ;;
  esac
}

# Green LED
curl -s -o /dev/null http://127.0.0.1:5000/led/0/100/0 2>/dev/null || true
curl -s -o /dev/null "http://192.168.4.99/rgb?r=0&g=255&b=0" 2>/dev/null || true
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=UpgrayeDD%20resuming" 2>/dev/null || true

clear
echo "................................................................................................................"
echo "................................................................................................................"
echo "................................................................................................................"
echo "................................................................................................................"
echo "................................................................................................................"
echo "...................................................:==-........................................................."
echo "............................:-+#@@@@*-:.........*@#-:.-@@@=-:..................................................."
echo "......................:=*#%#+-.....:-*@@@+:...:%#....-@@@=#@@@*................................................."
echo "....................-#@###+-.-=*#%%#*=:..+@@+-*%###%%#*++*%%@@@@-..:=*%%%#+-...................................."
echo ".................:+%@@-..-%@%+*............:*@#-......=#%*-.-@@@@%#%+:=*%%##@=.................................."
echo ":=*#%%*-........*%+-@-.-%#@@:-%:.............:+@%:..+%+:.=#@#--%@@*.-%@*=-+%*@+................................."
echo "+-:.=+-=#%%*-:%%=.:%=-%#:*%:.:#=.......:=#%%#+-:..-#=..=%-::-+*%@#.:#@:.....@*@:................................"
echo "#..=*:..-*@@%*=%:-#%@*:.-%-...++.:+#@%*=-:.:=#@%#==#:.=*.+@%#+-.#*.-%*.-@*..#*@-................................"
echo "@-:.-*@@%:.....***@*=:.:#=....:++-:..:*%@@*=:......*+:#=@@%:::=*@%..+@.....=@%%................................."
echo "+%%@@+..@-.....=@- :#@%=.......-*@@@+:.............-*#@@@-......:#%:.-@*-+@#@@.................................."
echo "..:#@%#@@#...=@@+#=..........+*...................:+@+............=@@#=--*@@=..................................."
echo ".*@-.-+@@@@%%@@@=............:%-...........:-*%@@#=:..................---:......................................"
echo "+@:=*::@@*..+@@@@**==-=*#=....+*.....:-*%@@#+:.................................................................."
echo "%+-*:.:@@+:=#=@@@+..-+#%%@#=..-#++#%%#=:........................................................................"
echo "#*=*.==@@@@%::@@@%#@#-:=*#*#@*.:-:.............................................................................."
echo ":@%#-.:@@@@@*+:@@@#::%@*==+%#*%:................................................................................"
echo "..+@@*-:=@@@*%%+%#.:@#......+@#+.................................:-=++++=:......................................"
echo "....-=**=-....:=@*.+@..-@*...@##...........................-*#+--:::...+%=...-@@@-...=##*:......................"
echo "................+%:.@-......%%%+.........................%=:.....=*#+-:-*@#+:::..-@@@@+#@%...:--:..............."
echo "................:#@-:@#:.:#@=@*..........................:===-:.-+*##+:.......-#%*+=:+@@%*-.....##.............."
echo "..................-@@#--=-=@@:........................:=*##*=:...........-#*-...:*@+........:+@#:..............."
echo ".....................-*##*=................:::-+**+-:...............:-*+:.....:%+..:::-=*%%*-..................."
echo "...................................:::-=**+-...................::-+*-..........-***+=-:........................."
echo ".........:-===++++++*:.....:---=+++-:....................:-==+*=:..............................................."
echo "....:=+++=:.......:==....:--......................-===+++-:....................................................."
echo "...:#+::.................................:=+++====:............................................................."
echo ".....::.....................:-+*****##=--::....................................................................."
echo "......................:=#*=-::......+#-........................................................................."
echo "...................-%+:........=#%+::..........................................................................."
echo "..................=@#+++*%@%+-:................................................................................."
echo "................................................................................................................"
echo "................................................................................................................"
echo "*******************************"
echo "***** UPGREYEDD RESUMING ******"
echo "*******************************"
cd rc-lap-timer

echo "*** UpgrayeDD untarring"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=untarring" 2>/dev/null || true
tar xzf ../rc-lap-timer-build.tar.gz

echo "*** UpgrayeDD npx prisma generate"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=prisma%20generate" 2>/dev/null || true
npx prisma generate

echo "*** UpgrayeDD updating the database schema"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=database%20schema" 2>/dev/null || true
# Databases from before Prisma migrations have no _prisma_migrations table. Bring them up to the baseline
# schema with db push (which refuses to drop data), then record the baseline migration as already applied.
if ! echo "SELECT 1 FROM _prisma_migrations LIMIT 1;" | npx prisma db execute --stdin --schema prisma/schema.prisma > /dev/null 2>&1; then
  echo "*** UpgrayeDD moving the database to Prisma migrations (one time)"
  if ! npx prisma db push --skip-generate; then
    echo "*** UpgrayeDD couldn't update the database schema without risking data (see above), so the upgrade stopped here."
    echo "    Roll back: rm -rf ~/rc-lap-timer && mv ~/rc-lap-timer.previous ~/rc-lap-timer && sudo systemctl start rc-lap-timer"
    echo "    Your database backup is in ~/db-backups/"
    exit 1
  fi
  npx prisma migrate resolve --applied 0_init
fi
npx prisma migrate deploy
# Stop if the database still doesn't match the schema, before the new app starts against it.
if ! npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code > /dev/null; then
  echo "*** UpgrayeDD says the database doesn't match the new schema, so the upgrade stopped here."
  echo "    See the differences: cd ~/rc-lap-timer && npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma"
  echo "    Roll back: rm -rf ~/rc-lap-timer && mv ~/rc-lap-timer.previous ~/rc-lap-timer && sudo systemctl start rc-lap-timer"
  echo "    Your database backup is in ~/db-backups/"
  exit 1
fi

echo "*** UpgrayeDD owning shit left and right"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=owning%20shit" 2>/dev/null || true
sudo chown -R pi:pi /home/pi/rc-lap-timer

echo "*** UpgrayeDD installing the System Settings helper"
sudo install -o root -g root -m 755 scripts/system/rc-config-helper.sh /usr/local/bin/rc-config-helper.sh

echo "*** UpgrayeDD deleting the old System Settings log (older versions wrote passwords to it)"
rm -f /home/pi/config-api.log

echo "*** UpgrayeDD making the app listen on localhost only (nginx is the way in)"
documented_exec='ExecStart=/usr/bin/node /home/pi/rc-lap-timer/node_modules/.bin/next start -p 3000'
sudo mkdir -p /etc/systemd/system/rc-lap-timer.service.d
if grep -qF -- "-H 127.0.0.1" /etc/systemd/system/rc-lap-timer.service; then
  echo "    Already listening on localhost only"
elif grep -qxF "$documented_exec" /etc/systemd/system/rc-lap-timer.service; then
  printf '[Service]\nExecStart=\n%s -H 127.0.0.1\n' "$documented_exec" | sudo tee /etc/systemd/system/rc-lap-timer.service.d/listen.conf > /dev/null
else
  echo "    The service's ExecStart isn't the documented one, so it was left alone. Add -H 127.0.0.1 to it by hand."
fi

echo "*** UpgrayeDD wiring up /etc/rc-lap-timer.env (admin PIN for System Settings)"
printf '[Service]\nEnvironmentFile=-/etc/rc-lap-timer.env\n' | sudo tee /etc/systemd/system/rc-lap-timer.service.d/env.conf > /dev/null
if ! sudo grep -q '^ADMIN_PIN=' /etc/rc-lap-timer.env 2> /dev/null; then
  echo "System Settings in the app need an admin PIN (6-32 letters or numbers)."
  echo "Leave it empty to keep System Settings disabled."
  admin_pin=""
  read -r -s -p "Admin PIN: " admin_pin || true
  echo
  if [ -n "$admin_pin" ]; then
    if [[ "$admin_pin" =~ ^[A-Za-z0-9]{6,32}$ ]]; then
      printf 'ADMIN_PIN=%s\n' "$admin_pin" | sudo tee -a /etc/rc-lap-timer.env > /dev/null
      sudo chmod 600 /etc/rc-lap-timer.env
    else
      echo "That PIN isn't 6-32 letters or numbers, so System Settings stay disabled. Add ADMIN_PIN to /etc/rc-lap-timer.env later."
    fi
  fi
fi

echo "*** UpgrayeDD updating the web server's settings (nginx)"
# The site's settings come from the repo. The old file stays as .bak, and goes back if nginx rejects the new one.
site=/etc/nginx/sites-available/rc-lap-timer
if [ ! -f "$site" ]; then
  echo "    $site doesn't exist, so nginx was left alone. See docs/raspberryPiSetup.md."
elif cmp -s scripts/system/nginx/rc-lap-timer.conf "$site"; then
  echo "    Already up to date"
else
  sudo cp "$site" "$site.bak"
  sudo install -o root -g root -m 644 scripts/system/nginx/rc-lap-timer.conf "$site"
  if sudo nginx -t > /dev/null 2>&1; then
    sudo systemctl reload nginx
    echo "    Updated (the old settings are in $site.bak)"
  else
    sudo nginx -t || true
    sudo cp "$site.bak" "$site"
    echo "    nginx rejected the new settings (see above), so the old ones were put back. Sync over plain HTTP"
    echo "    won't work until that's fixed; everything else does."
  fi
fi

echo "*** UpgrayeDD copying system utilities"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=copying%20utilities" 2>/dev/null || true
# Copy database files to home directory
cp -f ~/rc-lap-timer/scripts/database/clearDB.sql ~/

# Copy system files to home directory
cp -f ~/rc-lap-timer/scripts/system/backupDB.sh ~/
cp -f ~/rc-lap-timer/scripts/system/clearDB.sh ~/
cp -f ~/rc-lap-timer/scripts/system/piUpgrade1.sh ~/
cp -f ~/rc-lap-timer/scripts/system/piUpgrade2.sh ~/
cp -f ~/rc-lap-timer/scripts/system/recreateDB.sh ~/
cp -f ~/rc-lap-timer/scripts/system/restoreDB.sh ~/
cp -f ~/rc-lap-timer/scripts/system/upgrayedd.sh ~/

# Copy motd file to /etc (requires sudo)
sudo cp -f ~/rc-lap-timer/misc/etc/motd /etc/motd

# Make the scripts executable
cd ~
sudo chmod +x ./*.sh

# Verify all files were copied successfully
echo "Verifying files..."
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=verifying%20files" 2>/dev/null || true
files_to_check=(
    "$HOME/backupDB.sh"
    "$HOME/clearDB.sql"
    "$HOME/piUpgrade1.sh"
    "$HOME/piUpgrade2.sh"
    "$HOME/restoreDB.sh"
    "$HOME/recreateDB.sh"
    "$HOME/upgrayedd.sh"
    "/etc/motd"
)

all_files_exist=true
for file in "${files_to_check[@]}"; do
    if [ ! -f "$file" ]; then
        echo "Warning: $file was not copied successfully"
        all_files_exist=false
    fi
done

if $all_files_exist; then
    echo "All files were copied successfully"
    curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=all%20files%20copied" 2>/dev/null || true
else
    echo "Some files were not copied successfully. Please check the warnings above."
    curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=shit%20broke" 2>/dev/null || true
    exit 1
fi


echo "*** UpgrayeDD restarting the app and checking it's alive"
sudo systemctl daemon-reload
sudo systemctl restart rc-lap-timer
app_up=false
for _ in $(seq 1 45); do
  if curl -fs -o /dev/null --max-time 5 http://127.0.0.1:3000/; then
    app_up=true
    break
  fi
  sleep 2
done
if [ "$app_up" = true ]; then
  echo "*** UpgrayeDD says the app is up"
else
  echo "*** UpgrayeDD says the app did NOT come up, so nothing was rebooted."
  echo "    Logs:      sudo journalctl -u rc-lap-timer -n 50"
  echo "    Roll back: sudo systemctl stop rc-lap-timer && rm -rf ~/rc-lap-timer && mv ~/rc-lap-timer.previous ~/rc-lap-timer && sudo systemctl start rc-lap-timer"
  echo "    If it ran before this upgrade, also undo the new service settings:"
  echo "               sudo rm /etc/systemd/system/rc-lap-timer.service.d/listen.conf && sudo systemctl daemon-reload"
  echo "    Your database backup is in ~/db-backups/"
  exit 1
fi

# End the timer
end_time=$(date +%s)

# Calculate the time difference
time_diff=$((end_time - start_time))

# Convert to minutes and seconds for readability
minutes=$((time_diff / 60))
seconds=$((time_diff % 60))

# Red LED
curl -s -o /dev/null http://127.0.0.1:5000/led/100/0/0 2>/dev/null || true
curl -s -o /dev/null "http://192.168.4.99/rgb?r=255&g=0&b=0" 2>/dev/null || true


echo "*** UpgrayeDD asking what you want!"
echo "######******++*##%@@@@@@@@@%%%##%%%%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%%%%%%####%@@%#*++=++=*##"
echo "###*****++*#%%@@@@@@%%##**###%%%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%%%%%###**%@%#++===*++*#"
echo "##*****#%%@@@@@%#*++***##%%%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%%%%#**+=#%#+==-=*++##"
echo "#***#%@@@@@%#*+++**###%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%%#*+=-+#*==---+++*%"
echo "##%@@@@%#+=++**###%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%##*+=-+#*==---+*+*%"
echo "@@@@%*===+**###%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%##*+--*#+-=--:=++##"
echo "@@*=-=++*###%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%##%%%%%%%%%%%@@@@@@@%###@@@@@@@@@@@@@@@@@@@%%%#*+=-=#*=--:-:+++##"
echo "---=+**##%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@###*#*#######****%@@%#######%%%@@@@@@@@@@@@@@@@%%%#*+--*#+=--:-==**##"
echo "-==+*##%%%%%@@@@@@@@@@@@@%%%@@@@@@@@@@@@@@@%**++**+=+*%@%###%@@@@@@@@@@@@@%%%@@@@@@@@%@%%@@@%%##+=-+#+++-::-*=+###"
echo "=+**##%%%%%@@@@@@@@@@@%%%%@@%%@@@@@@@@@@@#+:..::-++#@@@@@@@@@@@@@@@@@@@@@@@##%@@@@@@@%%%%%@@%%#*=-*#+===--:*++***#"
echo "=+*##%%%%%@@@@@@@@@%%%%%%%%%@@%@@%%*-:....-+#%+-:#*@@@@@@@@@@@@%%%@@@@@@@@@@#+:*@@@@@%#%%%@%%#*+=#+=====-:++++****"
echo "+**##%%%%@@@@@@@@@@%%%%%@@%%#*=....:-==-+@@@@@*+=-#@@@@@@@@@@%%%%@@@@@@@@@@@%#=-%@@@@%#%%#@%%#+**======---++******"
echo "+*##%%%%%@@@@@@@@@@%%%%%*-...:==-.....:=@@@@@@%*-+#%@@@@@@@@@@%%@@@@@@@@@@@@@#+:*@@@@@@%%#%@@@@*=======--++++++***"
echo "+*##%%%%%@@@@@@@@@@@@@%-:==-........:::%@@@@@@@#%@@@%@@@@@@@@@@@@@@@@@@@@@@@@%#+#@@@@@@@@@@@@@@#=---=====+++++++**"
echo "+*###%%%%%@@@@@@@@%%@@%+%-:::::::::::-*@@@@@@@%%@##%@@@@@@@@@@@@@@@@@@@@@@@@@%%%@@@@@@@@@@@@@@%#=-----=====+++++++"
echo "+**##%%%%%@@@@@@@%%@@@@##------===+***@@@@@@@@%@%##%%@@@@@@@@@@@@@@@@@@@@@@@@%%%@@@@@@@@@@@@@@#*--------=====+++++"
echo "+**####%%%%@@@@@@@@@@@%%%%%@@@@@@@@@@@@@@@@@@%@@%%#*#%%@@@@@%%%%%%%%%%%%%%@@%##%@@@@@@@@@@@@@@%+---------=====++++"
echo "++**####%%@@@@@@@@@@@@*%%@@@@@@@@@@@@@%@@@%%%%%%#---=+*%%%@@%%%%%%%%%%%%%%%#*###@@@@@@@@@@@@@%+=+*+**+-----=====++"
echo "*##**####%@@@@@@@@@@@@#%%@@@@@@@@@@@@%%%%%###%%*-:::-=*##%@@%%%%%%%%%%#******+==+%@@@@@@@@@@#--=++*##*+=----=====+"
echo "--=+*#####%@@@@@@@@@@@#*@@@@@@@@%%%%%%####***##-...:=*###++*#%%%%%%%%@@@@@%#+-::.:@@@@@@@@@#-::-=+##%##+-----====+"
echo "---:::-+*##%@@@@@@@@@@@%%%@@@@@@%%%####**+++*+::==+*#%@@@@@@%%@@%*****##%%#*=:....*@@@@@@@@#---=+*%%%##=-:----===="
echo "--:::::..::+#%@@@@@@@@@@@@%@@@%%%###**+====*=-*%%%##%@@@@@@@%@@@%+=++*###%#*=:....=@@@@@@@@@#***%%@@%#*=:::-----=="
echo "-::::::::::::-+%@@@@@@@@@@%@@@%%%#*+===*##%#*%@@@@@%@@@@%%@@@%%##*++**##%%%*=:....-@@@@@@@@@@@@@@@@@%%*-::::-----="
echo "::::.:::=##%%%%#%@@@@@@@@@@@*===*#%%%%#*+==-=%@@%##%%#%@@@@@@%#****####%%%%#=:....=@@@@@@@@@@@@@@@@@@%+::::::-----"
echo "::::::-#@@@@@@@@%%@@@@@@@@@@@#*#%#*=::..::...:-=#@@@@@@@@@@@@@@@@@@%%%%%%%%#=:....#@@@@@@@@@@@@@@@@@%+:..:::::----"
echo "::::::*@@@@@@@@%#%%@@@@@@@@@@#+++=--:::::....:=%@@@#**+=+*##%%@@@@@@@@@%%@%#+-:::*@@@@@@@@@@@@@@@@@*:.....:::::---"
echo ":::::-*@@@@@%%%##%%%%@@@@@@@@#+++==---:::..:+%@@@*+===*%%%%%%%@@@@@@@@@@@%#*+==+%@@@%@@@@@@@@@@%*=+-.......:::::--"
echo "::::--=#@%%%%%%%%@@@@@@@@@@@@%*+++=====---*%@@@%#***#%%@@@@%%%%@@@@@@@@@@%#***%@@@@%%%%@@@@%%#***+*+.........:::--"
echo "-:::---+#%%@@@@@@@@@@@@@@@@@@@#*++++++++*%@@@@%%%%%##***=---=+*#%%@@@%@@@%%%@@@@@@@%#==%@@@@@@@@@%*:..........::--"
echo "-------==+#%%@@@@@@@@@@@@@@@@@%********#@@@@@@@@*-:..::-::-+*%%%%%@@%%%@@@@@@@@@@@%@%=-%@@@@@@@@%+-::..........::-"
echo "::------===++*##%%%@@@@@@@@@@@@%#******%@@@@@@#=---:-=+++*#%%@@@@@@%%%@@@@@@@@@@@@@@@=:#@@@@@@@%*+==---::.....::::"
echo "-::-------====+***###%%%%@@@@%@@@%#*****#@@@%*+++**###%%@@@@@@@@@@%%%%@@@@@@@@@@@@@@@+:#@@@@@@@%##**++==---:::.:::"
echo ":::-------===++****##%%%%@@@@%%@@@@%%##*#@@@#+++*#%%@@@@@@@@@@%%%%%%%%@@@@@@@@@%@@@@@+:*@@@@@@%%%%%###**++==---::."
echo "---::----===++**######%%%@@@@%#%@@@@@@@@@@@@%**++++**********#####%%%%@@@@@@@@%@@@@@@*:*@@@@@@@@%%%%%%###**++==--:"
echo "---------==++++++++++*##%@@@@#+%@@@@@@@@@@@@@%**++===-::--=++*###%%%%@@@@@@@%%%@@@@@@*-*@@@@@@@@@@@@%%%%%###**++=="
echo "------====++++**######*####@@#-#@@@@@@@@@@@@@%#**+==----=+**###%%%%@@@@@@@@%%%%@@@@@@#-*@@@@@@@@@@@@@@@%%%%###*++="
echo "-----=++=+++++#######%%%%@@@@#-#%#=#@@@@@@@@@@%#**++++++*##%%%%%%@@@@@@@@@%%%@*#@@%%@%=*@@@@@@@@@@@@@@@%%%%%###***"
echo "====+=====++++*#%%%%@@@@@@@@@*-+#+:-#%%@@@@@@@@@%#######%%%%%%@@@@@@@@@@%%%%@#=*@@@%%%+*@@@@@@@@@@@@@@@@%%%%%###**"
echo "---==++*++++***#####%@@@@@@%%+-*%-.:*%%%%%@@@@@@@@@@%%%%@@@@@@@@@@@@@@%%%%@@%=-+@@@@%#+#@@@@@@@@@@@@@@@%%%%%%###**"
echo "-===++++=+**###%%%#**#%@@@%#*=:*#:.:+%%==#@@@@@@@@@@@@@@@@@@@@@@@@@@%%%@@@@%+--*@@@@@%*#@@@@@@@@@@@@@@%%%%%%%%###*"
echo "--=+*####***#%%%%@@@@%@#####*=-##:.:+%@%=::-*%@@@@@@@@@@@@@@@@@@@@@@@@@@@@%+===#@@@@@%%#%@@@@@@@@@@@@@%%%%%%%#####"
echo "=+++*+*##%%###%%%%@@@@%%#***+=-#+:.:+#@@%+-:::-=*#%@@@@@@@@@@@@@@@@@@@@@@#**+++%@@@@@%%%##%@@@@@@@@@@@%%%%%%%#####"
echo "=++++*#%#***#%#@@@@@@@%##*++==-*=:.:=#@@@#+=-:::--=+*##%@@@@@@@@@@@@@@@%####***@@@@@@@%%%##%%%@@@@@@@@@%%%%%#%###*"
echo "==+**+*%%%#**##%@@@@@%##*++==-=+::::=*@@%%#*+=------==+*##%@@@@%##%%@@%%###***%@@@@@@@@%%%#*%%%%%@@@@@@@@%%%%#####"
echo "+*#**+=*%%%@@##%%@@@%##**+==----::::=*%@@#*#*++===----=+*%%%#++*****+#%######%@@%@@@@@@%%#%**#%%%%%%@@@@@@%%%%####"
echo "****+===*#%@@@@#%@%###*++==----::.::=*%@@#*++=======-=*@@@%+:-=+*###**#%####%%@@%@@@@@@@%###*+##%%%%%%@@@@@%%%####"
echo "**+###*=+#%@@@@@%####*++==--:::::.::-*%@%***++======+#%@@@@+--+*******#@%##%%@@@%@@@@@@@@####**#%%%%%%%%@@@@%%%###"
echo "++*##%%#+*%@@@@@%###**+==--::::::.::-+%@@@#+*++======++=++++==++++**#*%@%##%%@@@%@#%@@@@@@#*##*%%%@@%%%%%%%@@%%%##"
echo "+++*#%%%##%@@@@%%##**+==--::::::...:-+%@@@+-*#*+=::::::----=#+++*****%@@%##%%@@%#%%#@@@@@@%****++#%@@@@@%%%%%@%%##"
echo "*==+*#%@@#%@@@%%##**++=--::::::....::+*%@@@@*+***+-:::::::-@@%*+=+*%@@@@%##%%%%%#@@%%@%%@@@%***===+%@@@@@@@@@@@%%%"
echo "#*+++##%@@#@@%%%##*++=---:::::-+*##%#==*@@%%#=+##*+=:::::.%@@%#**==@@@@%%%*#%%%#%*-#%@%%%%@@#+**--++*%%@@@@@@@@@%%"
echo "#*##+*%%@@%%%%%##**+=---:=*%%@@***==:-+*@@@@@@%=****=:::.#@%%*=====%@%#######%#*@@@%#%%@@@@@%*+++-:-***%@@@@@@@@@@"
echo "+###*+#%@@%%%%%#*+++**#*@@%#%*%@*+::--:-#@@%#%#:.+#*+=::*@%%#+=+-----=*=--=#%####-+**##%%@%@@%+=++:::=###%%%@@@@@@"
echo "-*#%%*#%@%%%%%%@@@@@%##*@@%*#*%@+::=-::-+@%*#%%%@#****+-@+*+:==-#:*%*-*-**-*##**#@@+%+*@@@@@@@#==++:::-+###%@@@@@@"
echo "-=##%#*%%@@@@@@@@%%@@@@@@@@@@@#::-=:.:::=%@@@@+%@*-*****#:-=:*%+%=-#*%@==%%@%%#%+-#*%++%**%%@@@*-=+=::-=+*###%@@@@"
echo "=-+#%%#%@@@@@@@@@@%@@@@#%+**#=:-+:....::-*@@@%%#-+%%%#***+:==:=##+:==*%+---%%%%#@@+%*+=#%%%%%%%@+-=+-::-=+**###%@@"
echo "*+=*%%%#@@@@@@%@@@@@@@@%*#*-:-=-::...:::-+%@%%@##-%@#*#**++=#*--=%-*+-=*-#@%%%%%+=%#+*=*@%@@@@%%%-:==-::-=+**###%#"
echo "*#++%@@@%@@@@@@@@@%*#*#@@*:-==:::::::::::=#@@@@@*%=:=#%%#%**#%%+:*=+#=-#-+%-#%@@+#@*+*==%%%@@@@@@%::==-::-=+**####"
echo "+##+#%@@@@@@@@@@@@#***%#--==-::::::::::::-*@@@%%%*%%*@@%=*##+-**-**=**+*===+*%%%%%#==*+-#%*#%##%@@#::==-:-==+**###"
echo "+*%*#%@@@@@@@@@@@@@@@%=-=+-::::::::::::::-+%@@#*#%+#*:-++#%%*=-=*@*+##%%@@%%%%@%#%+-=*+-+@#%%%#%%@@+:-=-::-==+***#"
echo "**###%@@@@@@@@%%##%%+-=+=:::::::::::::::::-*@@%@@@#+##%#%@@+=*###+*#%#*+++*####**#--=*+--%%@@@@%%@@%=:-=-::-==++**"
echo "#**%%%%@@@@@@@@%%#+==+=:::::::::::::::::::-+%@@@@@@#+##*==+*%@@%#****+===*%*==++#=--=**=-*@#%%@@@@@@#-:-=-::-==+++"
echo "UpgrayeDD took $minutes minutes and $seconds seconds"

prompt_user
read_user_input
handle_choice