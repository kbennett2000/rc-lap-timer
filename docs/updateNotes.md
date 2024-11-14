# Update a build 

## Delete the old build:
```bash
rm -rf rc-lap-timer && rm rc-lap-timer-build.tar.gz && sudo rm -rf /var/www/rc-lap-timer/                       
```


## On the build machine
```bash
npm run build
```

```bash
tar -czf rc-lap-timer-build.tar.gz * .next package.json package-lock.json node_modules public
```

```bash
scp rc-lap-timer-build.tar.gz pi@rclaptimer.local:~
```


## Install the updated build
```bash
mkdir rc-lap-timer && cd rc-lap-timer
```

```bash
tar xzf ../rc-lap-timer-build.tar.gz && sudo mkdir -p /var/www/rc-lap-timer && sudo cp -r .next/* /var/www/rc-lap-timer/
```

```bash
cat > .env << 'EOF'
DATABASE_URL="mysql://rc_timer_user:password1@localhost:3306/rc_lap_timer"
EOF
```

```bash
npx prisma generate && npx prisma db push
```

```bash
sudo chown -R pi:pi /home/pi/rc-lap-timer
```

## Reboot!
```bash
sudo reboot now
```