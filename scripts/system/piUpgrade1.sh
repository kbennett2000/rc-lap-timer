#!/bin/bash

# Start the timer
start_time=$(date +%s)

# Green LED
curl -s -o /dev/null http://127.0.0.1:5000/led/0/100/0 2>/dev/null
curl -s -o /dev/null "http://192.168.4.99/rgb?r=0&g=255&b=0" 2>/dev/null
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=Starting%20UpgrayeDD" 2>/dev/null
curl -s -o /dev/null "http://192.168.4.99/pattern?name=upgrayedd" 2>/dev/null


clear
echo "--------------------------------------------------------------------------------------------------------------------"
echo "--------------------------------------------------------======------------------------------------------------------"
echo "------------------------------------------------=+*#****++****#####*+-----------------------------------------------"
echo "--------------------------------------------=*#*+++++********#%%%%##*##*=-------------------------------------------"
echo "------------------------------------------+#+++***************#%%@@%%#+=**------------------------------------------"
echo "----------------------------------------+#==******************##%%%@%#*=-**-----------=*+-====----------------------"
echo "---------------------------------------#*:-+******************##%%@@%%#+-=#=-----+*#**%*++==+*##%#*=----------------"
echo "--------------------------------------+%.:=+*********##%%%%%%%%%%@@@@%#*=-#+---*#****########**++++*##+-------------"
echo "--------------------------------------+%.:=+****#%#**++++++**###%%%%%%%%#+*##%%#####*****##*****#%#*+++**=----------"
echo "--------------------------------------+%.:=*#%*+**+**+++++***###%%%%%%%%%@@@@%%%##***##%@@@@%%###+*##+=+%@#---------"
echo "--------------------------------------+#.-#*+###***+++++****##%%@@%#*++++**##############*++#@@@@%*+*%#+==%---------"
echo "--------------------------------------+@#=+*####*******#%%%%#**##%%###%####################**++%**@#+*#%*+*%=-------"
echo "--------------------------------------*#:=######*#%@%#**#%%%%%##############################***-#*-*%*+%#=+@%-------"
echo "--------------------------------------*#:*#%%@%%###%@@@@@@@@@@@@@@@@@@@@@@@@%%##########*#****++:%+=####%*==#-------"
echo "-------------------------------------=#@@%###@@@@@@@@@@@@@@@@%%%#####%@@@@@@@@@@%%%####*#***++++:+#-=##=##=+#*------"
echo "--------------------------------=*%@%*#%@@@@@@@@@@@@%%%##########%%%%%%@@@@@@##@@@@%#%##**+*++=+:+#--+*=#%=:#*------"
echo "----------------------------*%@%*#%@@@@@@@@#=+#%%@@@@@@@%#@*%@@@@@@@@@%#+*@@%%**@@@%#%#%#*+*+*==:#*--=###%=#+*------"
echo "------------------------+%%*+%@@@@@@@@@@@@%*#%@@@@@@@@@@#-=-+:+%@@@@@@@@%+%@@**%@@%%%#%*%+#++++:=@---+*-*%==%+------"
echo "---------------------*%#+#@@@@@@@@@@@@@@@@#+*+====*%@@@@+#%#*@@@@#%@@@@@@*+%@#*@@@@%%%#@+#+*+=-=@=--=##*%#==%-------"
echo "-------------------##=*%#%%%%%%@@@@@@@@@@@**@@@@@@@@@@@*%#+#%*@@@@@@@@@@@*+%@##%%@@%%%%##+*+=-+%=----***#=%#=-------"
echo "-----------------*#-%######%%%%%@@@@@@@@@@%##%%%%%%%%#*#+::=##*%%%%%%%%%#*%@@#++@@@@@#@*#++--#*-----+%#%*+@=--------"
echo "----------------+%=%######%##%%%%@@@@@@@%@@#*###******#*=::-+####****###**#@%#*#@@@@@#%++=-*#=-----=*#%*%#----------"
echo "----------------+#=####%%%%%%%@%@@@@@@@%@@%+**++++**##*##***#%##%#******#*+%@#%@@@@@%#+==##=------=#%###=-----------"
echo "-----------------*#-*###%%%%%%@%%@@@@@@@#@%=-***+=-=*##**#@%###%#*-=**#*+:*@%#*@@%%*==*%*-------=*%#%*=-------------"
echo "------------------=%*=*###%%%%%@%%%%@@@%**%#:-++=-+#+++*####%##*++#=+##+:-#%##+%*++##+:..:-----=++=-----------------"
echo "---------------------*#*+**#%%%%%@@%%@@%=#@#-.=+++*+#%#**+=+**#%@#+#*##+:-##%+*%#*-.......:-------------------------"
echo "------------------------+###***###%%@@@@*=*%=.=++**%#*#%%%###%%%#%@*###+-=%#=#=............:------------------------"
echo "-----------------------------+*####*****#%*%+.-+++####+=--=--=+*###%##*=:=##%:.............:------------------------"
echo "-------------------------------.......::--+@*:.-++++++*#@@@@@%#****##*+-:*%##...............:-----------------------"
echo "------------------------------:...........=%@+..-++++++++*+++++**##**-::=%##+::..............:----------------------"
echo "------------------------------.............=%@#-..-++++=:::::-+*##*=-::+%@#=:................:----------------------"
echo "-----------------------------:..............:#=+#+::=+++====+**#*=:-+##=**:...................----------------------"
echo "-----------------------------................++.-*%#+++**###%##++*%@@%+-*+....................:---------------------"
echo "-----------------------------...............-##::+*#%@@%%@@@%%%@@@@@@#==%#-...................:---------------------"
echo "-----------------------------.............:+#%**:+**++*%%@@@@@@@@@@@%*+**#%*:.................:---------------------"
echo "-----------------------------............-***#:-#***+=-=++*##%@@@@@@%%+-=%#+%*:...............:---------------------"
echo "-----------------------------..........:*+-+@#:..=%%*=--=+**##%%@@@@+-:-+%@#-+#*:.............:---------------------"
echo "-----------------------------......:-*#*-=+%@%-....=#%+--+**##%%@%=::==-*#%%*=+=##*-:.........:---------------------"
echo "-----------------------------:.-+##+#%-:+=#@%%+:.....-*%#***#%%*-.:=-+-=##%%#+**=+%**##+-:....----------------------"
echo "--------------------------=*%#+---+#=-=*=#%@%#*-........-#@%*-....==---***%@%*+#*+=#%*+==+##+-----------------------"
echo "---------------------=*##*=:::=+*%*=+**=*##*#*%-:......-##*##-...:-::-=#+%**@=**##*+*%#%#+=--=*%%*=-----------------"
echo "----------------=*%#+-::::==***#%++****=*%%#%*#+-:....+#*+**#%+.....:-#+*%%#@+***###*+%%###*+==-:-=*#%*=------------"
echo "-----------=+#%*-:.::==++++***%#+******#%%*=##*%::...+%*+++**#%=...:-+#=##=*@#%**###****@###**+++++----=+#%#+-------"
echo "--------=%*#+.:--=+=+++*****#%=*******%+*%**%#+%+-:.-%%#*++*##%%-.:-=%=*%*=#@:#%#*******+%%******+**+++=+---####=---"
echo "--------%=:#*=+++++*******#%=+******%*=*#@@%%#**%:::*#%##***##%%+::-%++%#%%@%:**%#********#%#***********+*+=%*=**---"
echo "-------+%:*##************%#+******#%=+**#@%*+##+@=:=#-=%@#%%@%==#-:+#=#%#+*#*=**+*%*********%#**************%*++*=--"
echo "-------*#:*#%*************#@%****#*+***##%*=+%#**#-*+.-#-:*#%#::**-@-*%*=*#%+=***++%#****#@%#***********####%+++#=--"
echo "-------**:**%**#****#%%#****#@@%%++****##@%##@#*+@**::#=::*#%%*::##++%%#%@%%-******=#%#@@%#***##%******####%#*+=#=--"
echo "-------+*.+*%#*******%-:-+#%@@@#=*******#@##+-+%*#%-:*==--**#%#=:+%-@#**+=%%-*******++@@@@#*=--%@#*****##**@**=-#=--"
echo "-------#+.-*#%*******%*-*****+==********#@@%+=#@*+%=*+-**-###%##=#=#@-=%%*#*=********+=+****+=%@%#*****##*#%+*=:#*--"
echo "------=#:.=*#%#******#%+=****************@#+##=##*##*+##+-*#####%*+%=@#**%@=+***********#%#*=#@%%#****####@***=-=#=-"
echo "------+*:-=+*%%******#%#=+***************%%%#-:-#%#@*=+-##***###%%@===###@#-+**************+#@@%#****#####@+***-:#+-"
echo "------#+:-+**#%#*****#%@*=***************#@#*%@%+*%#*++-#***###%@==@@*=##%+=+*************+*@%##****#####%%****+:+#-"
echo "-----*#::=+*+*%##****##%%=+**************#@#+##*==#%%**++***##%%#*=*@#+#%#-=***************%@%%*=@#*#####@**##*+=:##"
echo "----=#=.==+##*#%###*+*#%@#=+**************@@%#*#%*-=*%#*****#*+==%+=##%##*-+**************%@#*=::@%%#=+%%%**%##*+-=@"
echo "----=#=-=**#%##%#%#****#%@*=**************%@%%#*=+#%%%%##%#**-#%=-#*%***%==**************%%*=::==@%-:-+%@##@%%##*==@"
echo "-----*=+**%%%%%%%%%%#+**#%@=+*************#@%#%##%##%*=+%+:##*+%#+*%***%#-+*************%%+::-=##*:-+**%%%@%%%%#**+#"
echo "-------=*##%#%%@%%%%##****%@-+*************%@%#%*=--**#**+-%#+=*+*%***%%+-*************#%-=*+=#%+:=+#*#@@@%%%%%#*+--"
echo "----------++*##@@%%%%#*+***%%-+************#@%#**#%%#*####+%#+#%%#***#%#=+************#@*#+--#%+-+%##*@@@@####*=----"
echo "--------------=+#######*****%#-*************%@%#****#%*##%%@@@#**+*##%%*-************#@%+=++#%++#@%%%#*%%++=--------"
echo "--------------------==++++++*%*=************#@%%#****#@#%*@%%#+*++###%%=+***********#@%##********++++==-------------"
echo "------------------------------=-=++++********%%%#***##+-+-**##*++*###%*=***********#@#**++++===---------------------"
echo "-----------------------------------------====+*+*+*#=*%*%=@%*#*+++****-=+++=======-==-------------------------------"
echo "******************************"
echo "***** UPGREYEDD ENGAGED ******"
echo "* With two D's for a double  *"
echo "*   dose of that pimpin!     *"
echo "******************************"
sleep 2

echo "*** UpgrayeDD backing up your database"
# Red LED
curl -s -o /dev/null http://127.0.0.1:5000/led/100/0/0 2>/dev/null
curl -s -o /dev/null "http://192.168.4.99/rgb?r=255&g=0&b=0" 2>/dev/null
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=Waiting%20for%20db%20cycle" 2>/dev/null
./dbCycle.sh
# Green LED
curl -s -o /dev/null http://127.0.0.1:5000/led/0/100/0 2>/dev/null
curl -s -o /dev/null "http://192.168.4.99/rgb?r=0&g=255&b=0" 2>/dev/null

echo "*** UpgrayeDD deleting project folder"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=deleting%20project%20%20%20%20%20folder" 2>/dev/null
rm -rf rc-lap-timer

echo "*** UpgrayeDD deleting tar file"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=deleting%20tar%20file" 2>/dev/null
rm rc-lap-timer-build.tar.gz

echo "*** UpgrayeDD deleting system files"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=deleting%20system%20files" 2>/dev/null
rm backupDB.sql
rm clearDB.sql
rm createDB.sql
rm dbCycle.sql
rm dropDB.sql
rm backupDB.sh
rm dbCycle.sh
rm restoreDB.sh
rm recreateDB.sh

echo "*** UpgrayeDD deleting var/www"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=deleting%20var%20www" 2>/dev/null
sudo rm -rf /var/www/rc-lap-timer/

echo "*** UpgrayeDD making a new home"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=making%20a%20new%20home" 2>/dev/null
mkdir rc-lap-timer
cd rc-lap-timer

echo "*** UpgrayeDD creating .env file"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=creating%20env%20file" 2>/dev/null
cat > .env << 'EOF'
DATABASE_URL="mysql://rc_timer_user:password1@localhost:3306/rc_lap_timer"
EOF

# End the timer
end_time=$(date +%s)

# Calculate the time difference
time_diff=$((end_time - start_time))

# Convert to minutes and seconds for readability
minutes=$((time_diff / 60))
seconds=$((time_diff % 60))

# Red LED
curl -s -o /dev/null http://127.0.0.1:5000/led/100/0/0 2>/dev/null
curl -s -o /dev/null "http://192.168.4.99/rgb?r=255&g=0&b=0" 2>/dev/null
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=Waiting%20for%20Johnny%205" 2>/dev/null

echo "*** UpgrayeDD done"
echo "*** UpgrayeDD took $minutes minutes and $seconds seconds"
echo "*** UpgrayeDD says run ./serverUpgrade.sh on your build box!"
curl -s -o /dev/null "http://192.168.4.99/text?title=UpgrayeDD&message=waiting%20for%20Johnny%205" 2>/dev/null